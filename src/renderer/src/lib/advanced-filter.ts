export type AdvancedFilter =
  | { type: "resolution"; width: number; height: number }
  | { type: "model"; value: string };

export function filterLabel(f: AdvancedFilter): string {
  if (f.type === "resolution") return `${f.width}×${f.height}`;
  return f.value || "(모델 없음)";
}

export function filterKey(f: AdvancedFilter): string {
  if (f.type === "resolution") return `res:${f.width}x${f.height}`;
  return `model:${f.value}`;
}

export function filtersEqual(a: AdvancedFilter, b: AdvancedFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "resolution" && b.type === "resolution") {
    return a.width === b.width && a.height === b.height;
  }
  if (a.type === "model" && b.type === "model") {
    return a.value === b.value;
  }
  return false;
}
