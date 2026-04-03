import { getDB } from "./db";

export type CategoryRow = {
  id: number;
  name: string;
  isBuiltin: boolean;
  order: number;
  color: string | null;
};

export async function listCategories(): Promise<CategoryRow[]> {
  return getDB().category.findMany({
    orderBy: [{ isBuiltin: "desc" }, { order: "asc" }],
  });
}

export async function createCategory(name: string): Promise<CategoryRow> {
  const last = await getDB().category.findFirst({
    where: { isBuiltin: false },
    orderBy: { order: "desc" },
  });
  return getDB().category.create({
    data: { name, order: (last?.order ?? -1) + 1 },
  });
}

export async function deleteCategory(id: number): Promise<void> {
  await getDB().category.delete({ where: { id } });
}

export async function renameCategory(
  id: number,
  name: string,
): Promise<CategoryRow> {
  return getDB().category.update({ where: { id }, data: { name } });
}

export async function updateCategoryColor(
  id: number,
  color: string | null,
): Promise<CategoryRow> {
  return getDB().category.update({ where: { id }, data: { color } });
}

export async function addImageToCategory(
  imageId: number,
  categoryId: number,
): Promise<void> {
  await getDB().imageCategory.upsert({
    where: { imageId_categoryId: { imageId, categoryId } },
    create: { imageId, categoryId },
    update: {},
  });
}

export async function removeImageFromCategory(
  imageId: number,
  categoryId: number,
): Promise<void> {
  await getDB().imageCategory.deleteMany({ where: { imageId, categoryId } });
}

function normalizeImageIds(imageIds: number[]): number[] {
  return [...new Set(imageIds.filter((id) => Number.isInteger(id)))];
}

export async function addImagesToCategory(
  imageIds: number[],
  categoryId: number,
): Promise<void> {
  const uniqueImageIds = normalizeImageIds(imageIds);
  if (uniqueImageIds.length === 0) return;

  const existing = await getDB().imageCategory.findMany({
    where: { categoryId, imageId: { in: uniqueImageIds } },
    select: { imageId: true },
  });
  const existingIds = new Set(existing.map((row) => row.imageId));
  const newData = uniqueImageIds
    .filter((imageId) => !existingIds.has(imageId))
    .map((imageId) => ({ imageId, categoryId }));

  if (newData.length > 0) {
    await getDB().imageCategory.createMany({ data: newData });
  }
}

export async function removeImagesFromCategory(
  imageIds: number[],
  categoryId: number,
): Promise<void> {
  const uniqueImageIds = normalizeImageIds(imageIds);
  if (uniqueImageIds.length === 0) return;

  await getDB().imageCategory.deleteMany({
    where: { categoryId, imageId: { in: uniqueImageIds } },
  });
}

export async function addImagesByPrompt(
  categoryId: number,
  query: string,
): Promise<number> {
  const images = await getDB().image.findMany({
    where: {
      OR: [
        { prompt: { contains: query } },
        { characterPrompts: { contains: query } },
      ],
    },
    select: { id: true },
  });
  const imageIds = images.map((img) => img.id);
  const existing = await getDB().imageCategory.findMany({
    where: { categoryId, imageId: { in: imageIds } },
    select: { imageId: true },
  });
  const existingIds = new Set(existing.map((e) => e.imageId));
  const newData = imageIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ imageId: id, categoryId }));
  if (newData.length > 0) {
    await getDB().imageCategory.createMany({ data: newData });
  }
  return images.length;
}

export async function getCategoryImageIds(
  categoryId: number,
): Promise<number[]> {
  const rows = await getDB().imageCategory.findMany({
    where: { categoryId },
    select: { imageId: true },
  });
  return rows.map((r) => r.imageId);
}

export async function getCategoriesForImage(
  imageId: number,
): Promise<number[]> {
  const rows = await getDB().imageCategory.findMany({
    where: { imageId },
    select: { categoryId: true },
  });
  return rows.map((r) => r.categoryId);
}

export async function getCommonCategoryIdsForImages(
  imageIds: number[],
): Promise<number[]> {
  const uniqueImageIds = normalizeImageIds(imageIds);
  if (uniqueImageIds.length === 0) return [];

  const rows = await getDB().imageCategory.findMany({
    where: { imageId: { in: uniqueImageIds } },
    select: { categoryId: true, imageId: true },
  });

  const categoryToImageIds = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!categoryToImageIds.has(row.categoryId)) {
      categoryToImageIds.set(row.categoryId, new Set<number>());
    }
    categoryToImageIds.get(row.categoryId)!.add(row.imageId);
  }

  const commonCategoryIds: number[] = [];
  for (const [categoryId, ids] of categoryToImageIds.entries()) {
    if (ids.size === uniqueImageIds.length) {
      commonCategoryIds.push(categoryId);
    }
  }
  return commonCategoryIds;
}

export async function seedBuiltinCategories(): Promise<void> {
  const builtins = [
    { name: "즐겨찾기", order: 0 },
    { name: "랜덤 픽", order: 1 },
  ];
  for (const { name, order } of builtins) {
    const existing = await getDB().category.findFirst({
      where: { isBuiltin: true, name },
    });
    if (!existing) {
      await getDB().category.create({ data: { name, isBuiltin: true, order } });
    }
  }
}
