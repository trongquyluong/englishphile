import fs from "node:fs";
import path from "node:path";

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function resolveSqliteDatabasePath(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("db:backup only supports SQLite file: DATABASE_URL values.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  const withoutQuery = rawPath.split("?")[0];
  const candidates = [
    path.resolve(process.cwd(), withoutQuery),
    path.resolve(process.cwd(), "prisma", withoutQuery),
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing ?? candidates[1];
}

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}
