import { readFileSync } from "fs";
import type { ImageMeta } from "@/types/image-meta";
import { readComfyuiMetaFromBuffer } from "./comfyui";
import { readMidjourneyMetaFromBuffer } from "./midjourney";
import { readNaiMetaFromBuffer, readNaiMetaFromWebp } from "./nai";
import { readWebuiMetaFromBuffer } from "./webui";

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function readImageMetaFromBuffer(buf: Buffer): ImageMeta | null {
  if (isWebp(buf)) return readNaiMetaFromWebp(buf);
  return (
    readWebuiMetaFromBuffer(buf) ??
    readComfyuiMetaFromBuffer(buf) ??
    readMidjourneyMetaFromBuffer(buf) ??
    readNaiMetaFromBuffer(buf)
  );
}

export function readImageMeta(filePath: string): ImageMeta | null {
  try {
    const buf = readFileSync(filePath);
    return readImageMetaFromBuffer(buf);
  } catch {
    return null;
  }
}
