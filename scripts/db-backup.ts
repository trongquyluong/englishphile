import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { ensureDir, resolveSqliteDatabasePath, timestampForFile } from "./db-utils";
import { classifySafeError } from "@/lib/operations/safe-error";

async function main() {
  const source = resolveSqliteDatabasePath();
  const backupDir = path.resolve(process.cwd(), "backups");
  await ensureDir(backupDir);
  const backupPath = path.join(backupDir, `englishphile-${timestampForFile()}.db`);
  await fs.copyFile(source, backupPath);
  console.log("Đã tạo backup trong thư mục backup đã cấu hình.");
}

main().catch((error) => {
  console.error(`Database backup failed (${classifySafeError(error)}).`);
  process.exitCode = 1;
});
