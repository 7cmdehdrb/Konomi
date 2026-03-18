import i18n from "@/lib/i18n";

export type AdvancedFilter =
  | { type: "resolution"; width: number; height: number }
  | { type: "model"; value: string };

export function filterLabel(filter: AdvancedFilter): string {
  if (filter.type === "resolution") {
    return `${filter.width}x${filter.height}`;
  }

  return filter.value || `(${i18n.t("common.none")})`;
}

export function filterKey(filter: AdvancedFilter): string {
  if (filter.type === "resolution") return `res:${filter.width}x${filter.height}`;
  return `model:${filter.value}`;
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
