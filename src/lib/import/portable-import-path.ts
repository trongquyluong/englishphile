import path from "node:path";

/**
 * Resolve one file from the operator-selected portable import directory.
 * Portable file names come from the script's fixed importSteps list; reject
 * absolute or nested names so this helper cannot escape that directory.
 */
export function resolvePortableImportFile(inputDirectory: string, fileName: string) {
  if (!inputDirectory.trim()) {
    throw new Error("Thiếu thư mục import portable.");
  }

  if (
    !fileName ||
    path.isAbsolute(fileName) ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    path.basename(fileName) !== fileName
  ) {
    throw new Error("Tên file import portable không hợp lệ.");
  }

  return path.join(inputDirectory, fileName);
}
