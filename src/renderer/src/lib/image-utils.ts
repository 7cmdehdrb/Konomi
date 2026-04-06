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

/** Web 서버 모드 여부: api-client.ts가 platform='web'으로 설정 */
function isWebServerMode(): boolean {
  // api-client.ts가 window.appInfo를 세팅하기 전(=Electron 없음)이면 web mode
  // api-client.ts는 platform='web' 으로 get()을 mock하지만 동기적으로 확인 불가
  // 대신, konomi:// 프로토콜은 브라우저에서 절대 동작하지 않으므로
  // location.protocol이 'file:' 또는 Electron 환경인지로 판단
  if (typeof window === "undefined") return false;
  // Electron renderer에서는 window.electron 또는 nodeIntegration 흔적이 있음
  // 가장 안전한 방법: api-client.ts가 설정한 마커로 판단
  // api-client.ts는 isWebMode = !window.appInfo 일 때만 실행되므로
  // 실행된 시점(import)에 appInfo가 없었다는 뜻 → Web 모드
  return (window as any).__konomiWebMode === true;
}

export function rowToImageData(row: ImageRow): ImageData {
  // api-client.ts의 최상단에서 __konomiWebMode를 설정하도록 (하단 참고)
  // fallback: location.protocol이 http(s)이고 Electron이 아니면 Web 모드
  const isWeb = (window as any).__konomiWebMode === true ||
    (typeof window !== "undefined" &&
     !window.location.protocol.startsWith("file") &&
     !(window as any).electron);
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
