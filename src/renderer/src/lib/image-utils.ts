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
 * Web 서버 모드 여부를 판단합니다.
 * - Electron 앱: window.location.protocol === "file:"
 * - 브라우저 (Web): window.location.protocol === "http:" 또는 "https:"
 * 
 * 이것이 가장 단순하고 확실한 방법입니다.
 * window.appInfo나 모듈 로딩 순서에 전혀 의존하지 않습니다.
 */
function isWebMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function rowToImageData(row: ImageRow): ImageData {
  const isWeb = isWebMode();
  const base = isWeb
    ? `/api/images/serve?path=${encodeURIComponent(row.path)}`
    : `konomi://local/${encodeURIComponent(row.path.replace(/\\/g, "/"))}`;
  return {
    id: String(row.id),
    path: row.path,
    src: isWeb ? `${base}&w=${GALLERY_THUMB_WIDTH}` : `${base}?w=${GALLERY_THUMB_WIDTH}`,

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
