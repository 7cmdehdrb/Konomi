import { NovelAI } from "novelai-sdk-unofficial";
import { getDB } from "./db";
import path from "path";
import fs from "fs/promises";

export interface NaiConfigPatch {
  apiKey?: string;
}

export interface I2IRef {
  imageData: Uint8Array;
  strength: number;
  noise: number;
}

export interface VibeRef {
  imageData: Uint8Array;
  infoExtracted: number;
  strength: number;
}

export interface PreciseRef {
  imageData: Uint8Array;
  fidelity: number;
}

export interface GenerateParams {
  prompt: string;
  negativePrompt?: string;
  characterPrompts?: string[];
  characterNegativePrompts?: string[];
  outputFolder?: string;
  model?: string;
  width?: number;
  height?: number;
  scale?: number;
  sampler?: string;
  steps?: number;
  seed?: number;
  noiseSchedule?: string;
  i2i?: I2IRef;
  vibes?: VibeRef[];
  preciseRef?: PreciseRef;
}

export async function getNaiConfig() {
  return getDB().naiConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function updateNaiConfig(patch: NaiConfigPatch) {
  return getDB().naiConfig.upsert({
    where: { id: 1 },
    update: patch,
    create: { id: 1, ...patch },
  });
}

export async function generateImage(params: GenerateParams): Promise<string> {
  const config = await getNaiConfig();
  if (!config.apiKey) throw new Error("API 키가 설정되지 않았습니다");
  if (!params.outputFolder) throw new Error("출력 폴더가 설정되지 않았습니다");

  const client = new NovelAI({ apiKey: config.apiKey });

  const model = params.model ?? "nai-diffusion-4-5-curated";
  const width = params.width ?? 832;
  const height = params.height ?? 1216;
  const chars = (params.characterPrompts ?? [])
    .map((prompt, index) => ({
      prompt: prompt.trim(),
      negativePrompt: params.characterNegativePrompts?.[index]?.trim() ?? "",
    }))
    .filter((c) => c.prompt);

  const images = await client.image.generate({
    prompt: params.prompt,
    negativePrompt: params.negativePrompt ?? "",
    model: model as any,
    size: [width, height] as [number, number],
    steps: params.steps ?? 28,
    scale: params.scale ?? 6.0,
    sampler: (params.sampler ?? "k_euler") as any,
    noiseSchedule: (params.noiseSchedule ?? "karras") as any,
    seed: params.seed,
    quality: false,
    ...(chars.length > 0 && {
      characters: chars.map((c) => ({
        prompt: c.prompt,
        negativePrompt: c.negativePrompt,
        position: [0.5, 0.5] as [number, number],
      })),
    }),
    ...(params.i2i && {
      i2i: {
        image: Buffer.from(params.i2i.imageData),
        strength: params.i2i.strength,
        noise: params.i2i.noise,
      },
    }),
    ...(params.vibes?.length && {
      controlnet: {
        images: params.vibes.map((v) => ({
          image: Buffer.from(v.imageData),
          infoExtracted: v.infoExtracted,
          strength: v.strength,
        })),
      },
    }),
    ...(params.preciseRef && {
      characterReferences: [
        {
          image: Buffer.from(params.preciseRef.imageData),
          fidelity: params.preciseRef.fidelity,
        },
      ],
    }),
  });

  return saveImage(images[0], params.outputFolder);
}

async function saveImage(data: Buffer, outputFolder: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outName = `nai-${timestamp}.png`;
  const outPath = path.join(outputFolder, outName);
  await fs.mkdir(outputFolder, { recursive: true });
  await fs.writeFile(outPath, data);
  return outPath;
}
