import path from "path";
import fs from "fs";
import crypto from "crypto";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";
import { createLogger } from "./logger";

const log = createLogger("main/db");

let client: PrismaClient | null = null;
let migrationsDone = false;

export interface MigrationProgress {
  done: number;
  total: number;
  migrationName: string;
}

export function runMigrations(
  onProgress?: (progress: MigrationProgress) => void,
): void {
  if (migrationsDone) return;
  const migrationsPath = process.env.KONOMI_MIGRATIONS_PATH;
  if (!migrationsPath) {
    migrationsDone = true;
    return;
  }

  const dbPath = path.join(process.env.KONOMI_USER_DATA!, "konomi.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
            id TEXT PRIMARY KEY,
            checksum TEXT NOT NULL DEFAULT '',
            finished_at DATETIME,
            migration_name TEXT NOT NULL,
            logs TEXT,
            rolled_back_at DATETIME,
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            applied_steps_count INTEGER NOT NULL DEFAULT 0
        )`);

    let dirs: string[];
    try {
      dirs = fs
        .readdirSync(migrationsPath)
        .filter((d) => /^\d{14}/.test(d))
        .sort();
    } catch {
      migrationsDone = true;
      return;
    }

    const applied = db
      .prepare('SELECT migration_name FROM "_prisma_migrations"')
      .all() as { migration_name: string }[];
    const appliedSet = new Set(applied.map((m) => m.migration_name));

    const pending = dirs.filter((d) => !appliedSet.has(d));
    if (pending.length > 0) {
      log.info("Pending migrations", { count: pending.length });
    }
    let done = 0;

    for (const dir of pending) {
      const sqlPath = path.join(migrationsPath, dir, "migration.sql");
      let sql: string;
      try {
        sql = fs.readFileSync(sqlPath, "utf-8");
      } catch {
        log.warn("Migration SQL file not found, skipping", {
          migration: dir,
        });
        done++;
        continue;
      }
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      onProgress?.({ done, total: pending.length, migrationName: dir });
      log.info("Applying migration", { migration: dir });
      const applyMigration = db.transaction(
        (
          migrationName: string,
          migrationSql: string,
          migrationChecksum: string,
        ) => {
          db.exec(migrationSql);
          db.prepare(
            `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
             VALUES (?, ?, ?, datetime('now'), 1)`,
          ).run(crypto.randomUUID(), migrationChecksum, migrationName);
        },
      );
      try {
        applyMigration(dir, sql, checksum);
        log.info("Migration applied", { migration: dir });
      } catch (error) {
        // 트랜잭션 실패 시 롤백됨 — _prisma_migrations에 기록되지 않으므로
        // 다음 실행 시 자동 재시도됨
        log.errorWithStack("Migration failed, will retry on next launch", error, {
          migration: dir,
        });
        throw error;
      }
      done++;
    }

    if (pending.length > 0) {
      onProgress?.({ done, total: pending.length, migrationName: "" });
    }
  } finally {
    db.close();
  }
  migrationsDone = true;
}

/**
 * SQLite crash safety:
 * - better-sqlite3 defaults to DELETE journal mode → auto-rollback on next open
 * - All writes use transactions ($transaction / db.transaction) → atomic
 * - If DB is corrupted beyond journal recovery, delete konomi.db and re-scan
 *   (image files are untouched; only user metadata like favorites/categories is lost)
 */
export function getDB(): PrismaClient {
  if (!client) {
    runMigrations();
    const dbPath = path.join(process.env.KONOMI_USER_DATA!, "konomi.db");
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export async function disconnectDB(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = null;
}
