export type ContentPackInputFile = {
  fileName: string;
  content: string;
};

export type ContentPackManifestFile = {
  fileName: string;
  skillType?: string;
  problemCount?: number;
  questionCount?: number;
};

export type ContentPackManifest = {
  packName?: string;
  version?: string;
  description?: string;
  createdFor?: string;
  files?: ContentPackManifestFile[];
  totals?: {
    problemCount?: number;
    questionCount?: number;
  };
};

function safeParseManifest(content: string): ContentPackManifest | null {
  try {
    const parsed = JSON.parse(content) as ContentPackManifest;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function inferContentPackImportType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "JSON" as const;
  if (lower.endsWith(".csv")) return "CSV" as const;
  return null;
}

export function selectImportFiles(files: ContentPackInputFile[]) {
  const manifestFile = files.find((file) => file.fileName.toLowerCase() === "manifest.json");
  const manifest = manifestFile ? safeParseManifest(manifestFile.content) : null;
  const importable = files.filter((file) => {
    const lower = file.fileName.toLowerCase();
    return (lower.endsWith(".json") || lower.endsWith(".csv")) && lower !== "manifest.json";
  });
  const splitFiles = importable.filter((file) => /^\d{2}-/.test(file.fileName) && !file.fileName.startsWith("00-"));
  const hasAllInOne = importable.some((file) => file.fileName.startsWith("00-"));
  const selected = splitFiles.length > 0 && hasAllInOne ? splitFiles : importable;
  const selectedNames = new Set(selected.map((file) => file.fileName));
  const ignoredFiles = importable.filter((file) => !selectedNames.has(file.fileName)).map((file) => file.fileName);

  return {
    manifest,
    manifestFileName: manifestFile?.fileName ?? null,
    selected,
    ignoredFiles,
  };
}
