/**
 * Benchmark: worker pool size vs scan throughput (including I/O)
 * Usage: node scripts/bench-pool.mjs <png-dir> [pool-sizes...]
 * Example: node scripts/bench-pool.mjs D:/images 2 4 8 16
 */
import { readdirSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "..", "out", "main", "nai.worker.js");

const pngDir = process.argv[2];
const poolSizes = process.argv
  .slice(3)
  .map(Number)
  .filter((n) => n > 0);

if (!pngDir || poolSizes.length === 0) {
  console.error("Usage: node scripts/bench-pool.mjs <png-dir> [pool-sizes...]");
  console.error("Example: node scripts/bench-pool.mjs D:/images 2 4 8 16");
  process.exit(1);
}

const files = readdirSync(pngDir)
  .filter((f) => [".png", ".webp"].includes(extname(f).toLowerCase()))
  .map((f) => join(pngDir, f));

if (files.length === 0) {
  console.error("No PNG/WebP files found in", pngDir);
  process.exit(1);
}

console.log(`\nFiles: ${files.length}  Dir: ${pngDir}\n`);

function runWithPoolSize(size) {
  return new Promise((resolve) => {
    const idle = [];
    const queue = [...files];
    const callbacks = new Map();
    let seq = 0;
    let completed = 0;

    function dispatch(w) {
      const filePath = queue.shift();
      if (!filePath) {
        idle.push(w);
        return;
      }
      const id = seq++;
      callbacks.set(id, () => {
        callbacks.delete(id);
        completed++;
        if (completed === files.length) {
          workers.forEach((w) => w.terminate());
          resolve();
        } else {
          dispatch(w);
        }
      });
      w.postMessage({ id, filePath });
    }

    const workers = Array.from({ length: size }, () => {
      const w = new Worker(WORKER_PATH);
      w.on("message", ({ id }) => callbacks.get(id)?.());
      w.on("error", () => {
        // count as completed on error
        completed++;
        if (completed === files.length) {
          workers.forEach((w) => w.terminate());
          resolve();
        }
      });
      return w;
    });

    // Start all workers
    for (const w of workers) dispatch(w);
  });
}

console.log("pool  │   total ms │    img/s │ ms/img");
console.log("──────┼────────────┼──────────┼───────");

for (const size of poolSizes) {
  // warmup with 1 worker, small set — skipped to keep I/O fair (NAS won't cache anyway)
  const t0 = performance.now();
  await runWithPoolSize(size);
  const elapsed = performance.now() - t0;
  const imgPerSec = ((files.length / elapsed) * 1000).toFixed(1);
  const msPerImg = (elapsed / files.length).toFixed(1);
  console.log(
    `${String(size).padStart(5)} │ ${elapsed.toFixed(0).padStart(10)} │ ${imgPerSec.padStart(8)} │ ${msPerImg.padStart(6)}`,
  );
}
