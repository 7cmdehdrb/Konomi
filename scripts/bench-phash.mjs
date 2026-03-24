/**
 * Benchmark: native (libpng + C++ DCT) vs pure-JS pHash
 * Usage: node scripts/bench-phash.mjs <png-dir> [iterations]
 */
import { readFileSync, readdirSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { inflateSync } from "zlib";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Load native addon ─────────────────────────────────────────────────────────

const addonPath = join(root, "prebuilds", `${process.platform}-${process.arch}`, "konomi-image.node");
let nativeAddon = null;
try {
  nativeAddon = require(addonPath);
  console.log("Native addon loaded:", addonPath);
} catch (e) {
  console.error("Failed to load native addon:", e.message);
  process.exit(1);
}

// ── Pure-JS implementation (copied from phash.worker.ts) ─────────────────────

const PAETH = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

function decodePng(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const colorType = buf[25];
  const ch = colorType === 6 ? 4 : 3;
  const parts = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") parts.push(buf.subarray(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const s = y * (stride + 1) + 1;
    const d = y * stride;
    const p = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[s + x];
      const a = x >= ch ? px[d + x - ch] : 0;
      const b = y > 0 ? px[p + x] : 0;
      const c = x >= ch && y > 0 ? px[p + x - ch] : 0;
      px[d + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b :
        f === 3 ? v + ((a + b) >> 1) : v + PAETH(a, b, c)) & 0xff;
    }
  }
  return { px, w, h, ch };
}

const DCT_SIZE = 32, HASH_SIZE = 8;

function toGrayscaleGrid(px, srcW, srcH, ch) {
  const xr = srcW / DCT_SIZE, yr = srcH / DCT_SIZE;
  const grid = Array.from({ length: DCT_SIZE }, () => new Array(DCT_SIZE));
  for (let dy = 0; dy < DCT_SIZE; dy++) {
    for (let dx = 0; dx < DCT_SIZE; dx++) {
      const sx = dx * xr, sy = dy * yr;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1), y1 = Math.min(y0 + 1, srcH - 1);
      const xf = sx - x0, yf = sy - y0;
      const g = (x, y) => { const i = (y * srcW + x) * ch; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; };
      grid[dy][dx] = g(x0,y0)*(1-xf)*(1-yf) + g(x1,y0)*xf*(1-yf) + g(x0,y1)*(1-xf)*yf + g(x1,y1)*xf*yf;
    }
  }
  return grid;
}

function dct1d(arr) {
  const N = arr.length, out = new Array(N);
  for (let k = 0; k < N; k++) {
    let s = 0;
    for (let n = 0; n < N; n++) s += arr[n] * Math.cos(Math.PI * (2*n+1) * k / (2*N));
    out[k] = k === 0 ? s / Math.sqrt(N) : s * Math.sqrt(2 / N);
  }
  return out;
}

function computePHashJS(buf) {
  const { px, w, h, ch } = decodePng(buf);
  const pixels = toGrayscaleGrid(px, w, h, ch);
  const rowDct = pixels.map(dct1d);
  const colDct = Array.from({ length: DCT_SIZE }, () => new Array(DCT_SIZE));
  for (let x = 0; x < DCT_SIZE; x++) {
    const col = dct1d(rowDct.map(r => r[x]));
    for (let y = 0; y < DCT_SIZE; y++) colDct[y][x] = col[y];
  }
  const sub = [];
  for (let y = 0; y < HASH_SIZE; y++)
    for (let x = 0; x < HASH_SIZE; x++) sub.push(colDct[y][x]);
  const sorted = [...sub].sort((a, b) => a - b);
  const median = (sorted[31] + sorted[32]) / 2;
  let hash = 0n;
  for (const v of sub) hash = (hash << 1n) | (v > median ? 1n : 0n);
  return hash.toString(16).padStart(16, "0");
}

// ── Find PNG files ────────────────────────────────────────────────────────────

const pngDir = process.argv[2];
const iterations = parseInt(process.argv[3] ?? "1", 10);

if (!pngDir) {
  console.error("Usage: node scripts/bench-phash.mjs <png-dir> [iterations]");
  process.exit(1);
}

const files = readdirSync(pngDir)
  .filter(f => extname(f).toLowerCase() === ".png")
  .slice(0, 50)
  .map(f => join(pngDir, f));

if (files.length === 0) {
  console.error("No PNG files found in", pngDir);
  process.exit(1);
}

console.log(`\nFiles: ${files.length}  Iterations: ${iterations}\n`);

// Pre-read all files into memory (exclude I/O from benchmark)
const bufs = files.map(f => readFileSync(f));

// ── Run benchmarks ────────────────────────────────────────────────────────────

function bench(label, fn) {
  // Warmup
  for (const buf of bufs) fn(buf);

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++)
    for (const buf of bufs) fn(buf);
  const elapsed = performance.now() - t0;

  const total = files.length * iterations;
  const msPerImg = elapsed / total;
  console.log(`${label.padEnd(12)} ${elapsed.toFixed(0).padStart(7)} ms total  |  ${msPerImg.toFixed(2).padStart(7)} ms/img  |  ${(1000 / msPerImg).toFixed(0).padStart(5)} img/s`);
  return elapsed;
}

const jsTime     = bench("pure-JS",  computePHashJS);
const nativeTime = bench("native",   buf => nativeAddon.computePHash(buf));

console.log(`\nSpeedup: ${(jsTime / nativeTime).toFixed(2)}x`);

// Correctness check
console.log("\n── Correctness check (first 5 files) ──────────────────────");
let mismatch = 0;
for (let i = 0; i < Math.min(5, bufs.length); i++) {
  const js = computePHashJS(bufs[i]);
  const native = nativeAddon.computePHash(bufs[i]);
  const ok = js === native;
  if (!ok) mismatch++;
  console.log(`  ${ok ? "✓" : "✗"} JS=${js}  native=${native}`);
}
if (mismatch === 0) console.log("  All match.");
