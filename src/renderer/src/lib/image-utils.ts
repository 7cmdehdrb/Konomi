import type { ImageData } from "@/components/image-card";
import type { PromptToken } from "@/lib/token";
import type { ImageRow } from "@preload/index.d";

export function parseTokens(json: string | undefined): PromptToken[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === "string")
      return (parsed as string[]).map((text) => ({ text, weight: 1 }));
    return parsed as PromptToken[];
  } catch {
    return [];
  }
}

/** Max width for gallery thumbnails (px). Covers 2x DPI on typical grid columns. */
export const GALLERY_THUMB_WIDTH = 600;

/**
 * 로컬 파일 경로 → 이미지 서빙 URL 변환
 * 항상 HTTP /api/images/serve 엔드포인트 사용 (Web 서버 + Electron 공용)
 */
export function localPathToUrl(filePath: string): string {
  return `/api/images/serve?path=${encodeURIComponent(filePath)}`;
}

export function rowToImageData(row: ImageRow): ImageData {
  const base = localPathToUrl(row.path);
  return {
    id: String(row.id),
    path: row.path,
    src: `${base}&w=${GALLERY_THUMB_WIDTH}`,
    fullSrc: base,

    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    characterPrompts: (() => {
      try {
        return JSON.parse(row.characterPrompts) as string[];
      } catch {
        return [];
      }
    })(),
    tokens: parseTokens(row.promptTokens),
    negativeTokens: parseTokens(row.negativePromptTokens),
    characterTokens: parseTokens(row.characterPromptTokens),
    category: "",
    tags: [],
    fileModifiedAt: new Date(row.fileModifiedAt).toISOString(),
    isFavorite: row.isFavorite,
    pHash: row.pHash,
    source: row.source,
    folderId: row.folderId,
    model: row.model,
    seed: row.seed,
    width: row.width,
    height: row.height,
    cfgScale: row.cfgScale,
    cfgRescale: row.cfgRescale,
    noiseSchedule: row.noiseSchedule,
    varietyPlus: row.varietyPlus,
    sampler: row.sampler,
    steps: row.steps,
  };
}
