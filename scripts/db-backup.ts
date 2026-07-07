import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, resolveSqliteDatabasePath, timestampForFile } from "./db-utils";

async function main() {
  const source = resolveSqliteDatabasePath();
  const backupDir = path.resolve(process.cwd(), "backups");
  await ensureDir(backupDir);
  const backupPath = path.join(backupDir, `englishphile-${timestampForFile()}.db`);
  await fs.copyFile(source, backupPath);
  console.log(`Đã backup database: ${backupPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
