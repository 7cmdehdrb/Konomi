import { getDB } from "./db";

const DEFAULT_CATEGORIES = [
  "인원",
  "등급/검열 수준",
  "작화/스타일",
  "구도",
  "장소",
  "기타 효과",
  "퀄리티 태그",
  "캐릭터 - 성별/인외",
  "캐릭터 - 특정 캐릭터",
  "캐릭터 - 나이",
  "캐릭터 - 머리/안구",
  "캐릭터 - 의상",
  "캐릭터 - 자세",
  "캐릭터 - 행위",
  "캐릭터 - 신체 부위",
  "캐릭터 - 얼굴",
  "캐릭터 - 기타 효과",
];

async function seedDefaults() {
  const db = getDB();
  const count = await db.promptCategory.count();
  if (count > 0) return;
  await db.promptCategory.createMany({
    data: DEFAULT_CATEGORIES.map((name, i) => ({
      name,
      isBuiltin: true,
      order: i,
    })),
  });
}

export type PromptGroupWithTokens = {
  id: number;
  name: string;
  categoryId: number;
  order: number;
  tokens: { id: number; label: string; order: number }[];
};

export type PromptCategoryWithGroups = {
  id: number;
  name: string;
  isBuiltin: boolean;
  order: number;
  groups: PromptGroupWithTokens[];
};

export async function listCategories(): Promise<PromptCategoryWithGroups[]> {
  await seedDefaults();
  const db = getDB();
  return db.promptCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      groups: {
        orderBy: { order: "asc" },
        include: { tokens: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export async function createCategory(
  name: string,
): Promise<PromptCategoryWithGroups> {
  const db = getDB();
  const last = await db.promptCategory.findFirst({
    orderBy: { order: "desc" },
  });
  return db.promptCategory.create({
    data: { name, isBuiltin: false, order: (last?.order ?? -1) + 1 },
    include: {
      groups: { include: { tokens: true } },
    },
  });
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await getDB().promptCategory.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: number): Promise<void> {
  await getDB().promptCategory.delete({ where: { id } });
}

export async function resetCategories(): Promise<void> {
  const db = getDB();
  await db.promptCategory.deleteMany();
  await db.promptCategory.createMany({
    data: DEFAULT_CATEGORIES.map((name, i) => ({
      name,
      isBuiltin: true,
      order: i,
    })),
  });
}

export async function createGroup(
  categoryId: number,
  name: string,
): Promise<PromptGroupWithTokens> {
  const db = getDB();
  const last = await db.promptGroup.findFirst({
    where: { categoryId },
    orderBy: { order: "desc" },
  });
  return db.promptGroup.create({
    data: { name, categoryId, order: (last?.order ?? -1) + 1 },
    include: { tokens: true },
  });
}

export async function deleteGroup(id: number): Promise<void> {
  await getDB().promptGroup.delete({ where: { id } });
}

export async function renameGroup(id: number, name: string): Promise<void> {
  await getDB().promptGroup.update({ where: { id }, data: { name } });
}

export async function createToken(
  groupId: number,
  label: string,
): Promise<{ id: number; label: string; order: number; groupId: number }> {
  const db = getDB();
  const last = await db.promptToken.findFirst({
    where: { groupId },
    orderBy: { order: "desc" },
  });
  return db.promptToken.create({
    data: { label, groupId, order: (last?.order ?? -1) + 1 },
  });
}

export async function deleteToken(id: number): Promise<void> {
  await getDB().promptToken.delete({ where: { id } });
}

export async function reorderGroups(
  _categoryId: number,
  ids: number[],
): Promise<void> {
  const db = getDB();
  await db.$transaction(
    ids.map((id, i) =>
      db.promptGroup.update({ where: { id }, data: { order: i } }),
    ),
  );
}

export async function reorderTokens(
  _groupId: number,
  ids: number[],
): Promise<void> {
  const db = getDB();
  await db.$transaction(
    ids.map((id, i) =>
      db.promptToken.update({ where: { id }, data: { order: i } }),
    ),
  );
}
