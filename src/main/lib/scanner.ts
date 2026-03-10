import fs from "fs";
import path from "path";

export async function scanPngFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.promises.readdir(dir, {
      withFileTypes: true,
      recursive: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== ".png") continue;

      const parent = (entry as any).parentPath ?? (entry as any).path ?? dir;
      results.push(path.join(parent, entry.name));
    }
  } catch {
    // folder not accessible
  }
  return results;
}

export type CancelToken = { cancelled: boolean };

export async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  signal?: CancelToken,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const worker = async (): Promise<void> => {
    while (index < items.length && !signal?.cancelled) {
      const item = items[index++];
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}
