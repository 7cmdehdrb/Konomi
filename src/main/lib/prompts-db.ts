import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export const PROMPTS_DB_FILENAME = "prompts.db";
const DEFAULT_SUGGEST_LIMIT = 8;
const MAX_SUGGEST_LIMIT = 20;
const NORMALIZED_TAG_SQL = "LOWER(REPLACE(tag, '_', ' '))";

export type PromptTagSuggestQuery = {
  prefix: string;
  limit?: number;
  exclude?: string[];
};

export type PromptTagSuggestion = {
  tag: string;
  count: number;
};

let promptsDB: Database.Database | null = null;

function resolvePromptsDBPath(): string {
  const overridePath = (process.env.KONOMI_PROMPTS_DB_PATH ?? "").trim();
  if (overridePath) return overridePath;

  const userDataPath = (process.env.KONOMI_USER_DATA ?? "").trim();
  if (!userDataPath) {
    throw new Error("KONOMI_USER_DATA is not set for prompts.db access");
  }

  return path.join(userDataPath, PROMPTS_DB_FILENAME);
}

export function getPromptsDBPath(): string {
  return resolvePromptsDBPath();
}

export function hasPromptsDB(): boolean {
  return fs.existsSync(getPromptsDBPath());
}

export function normalizePromptTerm(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function normalizeSuggestLimit(limit?: number): number {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric)) return DEFAULT_SUGGEST_LIMIT;
  return Math.max(1, Math.min(MAX_SUGGEST_LIMIT, Math.floor(numeric)));
}

function normalizeExcludedTags(exclude?: string[]): string[] {
  if (!Array.isArray(exclude) || exclude.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of exclude) {
    const normalized = normalizePromptTerm(String(value ?? ""));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function getPromptsDB(): Database.Database {
  if (!promptsDB) {
    const dbPath = getPromptsDBPath();
    promptsDB = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    });
    promptsDB.pragma("foreign_keys = ON");
    promptsDB.pragma("query_only = ON");
  }

  return promptsDB;
}

export function closePromptsDB(): void {
  promptsDB?.close();
  promptsDB = null;
}

export function suggestPromptTags(
  query: PromptTagSuggestQuery,
): PromptTagSuggestion[] {
  if (!hasPromptsDB()) return [];

  const prefix = normalizePromptTerm(query?.prefix ?? "");
  if (!prefix) return [];

  const limit = normalizeSuggestLimit(query?.limit);
  const excluded = normalizeExcludedTags(query?.exclude);
  const excludedClause =
    excluded.length > 0
      ? ` AND ${NORMALIZED_TAG_SQL} NOT IN (${excluded.map(() => "?").join(", ")})`
      : "";

  let rows: Array<{ tag: string; count: number }>;
  try {
    const db = getPromptsDB();
    rows = db
      .prepare(
        `SELECT tag, post_count AS count
         FROM prompt_tag
         WHERE ${NORMALIZED_TAG_SQL} LIKE ?
         ${excludedClause}
         ORDER BY
           CASE WHEN ${NORMALIZED_TAG_SQL} = ? THEN 0 ELSE 1 END,
           post_count DESC,
           tag ASC
         LIMIT ?`,
      )
      .all(`${prefix}%`, ...excluded, prefix, limit) as Array<{
        tag: string;
        count: number;
      }>;
  } catch {
    return [];
  }

  return rows.map((row) => ({
    tag: row.tag,
    count: Math.max(0, Math.floor(row.count ?? 0)),
  }));
}
