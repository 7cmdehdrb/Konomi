import { getDB } from "./db";

export type FolderRow = {
  id: number;
  name: string;
  path: string;
  createdAt: Date;
};

export async function getFolders(): Promise<FolderRow[]> {
  return getDB().folder.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createFolder(
  name: string,
  path: string,
): Promise<FolderRow> {
  const db = getDB();
  const existing = await db.folder.findUnique({ where: { path } });
  if (existing) {
    throw new Error("이미 추가된 폴더 경로입니다.");
  }

  try {
    return await db.folder.create({ data: { name, path } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique constraint failed") && message.includes("path")) {
      throw new Error("이미 추가된 폴더 경로입니다.");
    }
    throw e;
  }
}

export async function deleteFolder(id: number): Promise<void> {
  await getDB().folder.delete({ where: { id } });
}

export async function renameFolder(
  id: number,
  name: string,
): Promise<FolderRow> {
  return getDB().folder.update({ where: { id }, data: { name } });
}
