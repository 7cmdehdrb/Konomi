import path from "path";
import { Worker } from "worker_threads";
import { getDB } from "./db";
import { withConcurrency } from "./scanner";

const SIMILARITY_THRESHOLD = 10;

// 4비트 popcount 룩업 테이블
const POPCOUNT4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

// ── pHash Worker Pool ─────────────────────────────────────────────────────────
// 모든 pHash 계산을 Worker Thread에서 실행 — 메인 프로세스 블록 방지
const POOL_SIZE = 4;
const WORKER_PATH = path.join(__dirname, "phash.worker.js");

class PHashPool {
  private idle: Worker[] = [];
  private queue: Array<{
    filePath: string;
    resolve: (h: string | null) => void;
  }> = [];
  private callbacks = new Map<number, (h: string | null) => void>();
  private workerTask = new Map<Worker, number>();
  private seq = 0;

  constructor(size: number, workerPath: string) {
    for (let i = 0; i < size; i++) this.addWorker(workerPath);
  }

  private addWorker(workerPath: string): void {
    const w = new Worker(workerPath);
    w.on("message", ({ id, hash }: { id: number; hash: string | null }) => {
      this.workerTask.delete(w);
      this.callbacks.get(id)?.(hash);
      this.callbacks.delete(id);
      this.dispatch(w);
    });
    w.on("error", () => {
      const id = this.workerTask.get(w);
      this.workerTask.delete(w);
      if (id !== undefined) {
        this.callbacks.get(id)?.(null);
        this.callbacks.delete(id);
      }
      this.addWorker(workerPath);
      this.flush();
    });
    this.idle.push(w);
    this.flush();
  }

  private dispatch(w: Worker): void {
    const next = this.queue.shift();
    if (!next) {
      this.idle.push(w);
      return;
    }
    const id = this.seq++;
    this.callbacks.set(id, next.resolve);
    this.workerTask.set(w, id);
    w.postMessage({ id, filePath: next.filePath });
  }

  private flush(): void {
    while (this.queue.length > 0 && this.idle.length > 0) {
      this.dispatch(this.idle.shift()!);
    }
  }

  run(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.queue.push({ filePath, resolve });
      this.flush();
    });
  }
}

const pHashPool = new PHashPool(POOL_SIZE, WORKER_PATH);

// ── Hamming 거리 ──────────────────────────────────────────────────────────────
export function hammingDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    dist += POPCOUNT4[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  }
  return dist;
}

// ── 전체 해시 초기화 ──────────────────────────────────────────────────────────
export async function resetAllHashes(): Promise<void> {
  const db = getDB();
  await db.image.updateMany({ data: { pHash: "" } });
}

// ── 미계산 이미지 해시 일괄 계산 (Worker Thread에서 실행) ─────────────────────
export async function computeAllHashes(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const startedAt = Date.now();
  const db = getDB();
  const images = await db.image.findMany({
    select: { id: true, path: true },
    where: { pHash: "" },
  });
  const total = images.length;

  let done = 0;
  let lastProgressAt = 0;
  let success = false;
  console.info(`[phash.computeAllHashes] start targets=${total}`);
  // Keep workers busy by running with higher queue concurrency.
  try {
    await withConcurrency(images, POOL_SIZE * 2, async (img) => {
      try {
        const hash = await pHashPool.run(img.path);
        if (hash) {
          await db.image.update({ where: { id: img.id }, data: { pHash: hash } });
        }
      } catch {
        // Skip unreadable files.
      }
      done++;
      const progressNow = Date.now();
      if (done === total || progressNow - lastProgressAt >= 100) {
        lastProgressAt = progressNow;
        onProgress?.(done, total);
      }
    });
    success = true;
    return done;
  } finally {
    const elapsedMs = Date.now() - startedAt;
    console.info(
      `[phash.computeAllHashes] end elapsedMs=${elapsedMs} processed=${done}/${total} success=${success}`,
    );
  }
}

// Similar group search (Union-Find)
export type SimilarGroup = {
  id: string;
  name: string;
  imageIds: number[];
};

export async function getSimilarGroups(
  threshold = SIMILARITY_THRESHOLD,
): Promise<SimilarGroup[]> {
  const db = getDB();
  const images = await db.image.findMany({
    select: { id: true, pHash: true },
    where: { NOT: { pHash: "" } },
  });

  if (images.length < 2) return [];

  // Union-Find
  const parent = Array.from({ length: images.length }, (_, i) => i);
  const rank = new Uint8Array(images.length);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a),
      rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra]++;
    }
  }

  for (let i = 0; i < images.length; i++) {
    const ha = images[i].pHash;
    if (!ha) continue;
    for (let j = i + 1; j < images.length; j++) {
      const hb = images[j].pHash;
      if (!hb) continue;
      if (hammingDistance(ha, hb) <= threshold) union(i, j);
    }
  }

  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < images.length; i++) {
    const root = find(i);
    const arr = groupMap.get(root);
    if (arr) arr.push(images[i].id);
    else groupMap.set(root, [images[i].id]);
  }

  return [...groupMap.values()]
    .filter((ids) => ids.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map((imageIds, i) => ({
      id: String(imageIds[0]),
      name: `유사 그룹 ${i + 1}`,
      imageIds,
    }));
}
