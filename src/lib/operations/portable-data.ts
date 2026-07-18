import type { Prisma } from "@prisma/client";
import {
  sanitizeDiagnosticAttemptMetadata,
  sanitizeDiagnosticSkillBreakdown,
  sanitizeDiagnosticTopicBreakdown,
} from "@/lib/dto/diagnostic";

export const PORTABLE_MANIFEST_MAX_BYTES = 32 * 1024;
export const PORTABLE_MANIFEST_MAX_COUNT = 1_000_000;
export const PORTABLE_MANIFEST_COUNT_NAMES = [
  "users", "sourceCollections", "topics", "problemTopics", "contentPacks", "importBatches",
  "problems", "questions", "theoryNotes", "contests", "contestProblems", "diagnosticAttempts",
  "userSkillProfiles", "userTopicProfiles", "learningRecommendations",
] as const;

type PortableManifestCountName = (typeof PORTABLE_MANIFEST_COUNT_NAMES)[number];
export type PortableManifest = {
  version: "1.0" | null;
  exportedAt: string;
  counts: Partial<Record<PortableManifestCountName, number>>;
};

const PORTABLE_MANIFEST_COUNTS = new Set<string>(PORTABLE_MANIFEST_COUNT_NAMES);
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

type ManifestParseResult = { ok: true; value: PortableManifest } | { ok: false };

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value as Record<string, unknown> : null;
}

function dataProperties(value: Record<string, unknown>): Map<string, unknown> | null {
  const properties = new Map<string, unknown>();
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return null;
    properties.set(key, descriptor.value);
  }
  return properties;
}

/**
 * Positive portable-manifest parser. Unknown top-level fields are ignored for
 * legacy note/warnings compatibility; unknown count names fail closed.
 */
export function normalizePortableManifest(value: unknown): ManifestParseResult {
  const source = plainRecord(value);
  if (!source) return { ok: false };
  const properties = dataProperties(source);
  if (!properties) return { ok: false };

  const versionValue = properties.get("version");
  const version = versionValue === undefined ? null : versionValue;
  if (version !== null && version !== "1.0") return { ok: false };

  const exportedAt = properties.get("exportedAt");
  if (typeof exportedAt !== "string" || exportedAt.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(exportedAt)) {
    return { ok: false };
  }
  const parsedDate = new Date(exportedAt);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString() !== exportedAt) return { ok: false };

  const countsSource = plainRecord(properties.get("counts"));
  if (!countsSource) return { ok: false };
  const countProperties = dataProperties(countsSource);
  if (!countProperties) return { ok: false };
  const counts: Partial<Record<PortableManifestCountName, number>> = Object.create(null);
  for (const [key, count] of countProperties) {
    if (!PORTABLE_MANIFEST_COUNTS.has(key)
      || typeof count !== "number"
      || !Number.isSafeInteger(count)
      || count < 0
      || count > PORTABLE_MANIFEST_MAX_COUNT) return { ok: false };
    counts[key as PortableManifestCountName] = count;
  }

  return { ok: true, value: { version: version as "1.0" | null, exportedAt, counts } };
}

export function parsePortableManifestBytes(bytes: Uint8Array): ManifestParseResult {
  if (bytes.byteLength === 0 || bytes.byteLength > PORTABLE_MANIFEST_MAX_BYTES) return { ok: false };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return normalizePortableManifest(JSON.parse(text));
  } catch {
    return { ok: false };
  }
}

export function portableManifestCountLines(manifest: PortableManifest): string[] {
  return PORTABLE_MANIFEST_COUNT_NAMES.flatMap((name) => {
    const count = manifest.counts[name];
    return count === undefined ? [] : [`  ${name}: ${count} rows`];
  });
}

export const PORTABLE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  fullName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  profile: { select: { id: true, targetExam: true, schoolTarget: true, school: true, province: true, avatarUrl: true, bio: true, level: true, createdAt: true, updatedAt: true } },
} satisfies Prisma.UserSelect;

export const PORTABLE_CONTEST_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  contestType: true,
  status: true,
  visibility: true,
  accessCodeUpdatedAt: true,
  durationMinutes: true,
  startsAt: true,
  endsAt: true,
  sourceName: true,
  rules: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContestSelect;

type PortableDiagnosticSource = Record<string, unknown> & {
  skillBreakdownJson?: unknown;
  topicBreakdownJson?: unknown;
  recommendationJson?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sanitizePortableUser(value: unknown) {
  const user = record(value);
  const profile = user.profile === null ? null : record(user.profile);
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: profile === null ? null : {
      id: profile.id,
      targetExam: profile.targetExam,
      schoolTarget: profile.schoolTarget,
      school: profile.school,
      province: profile.province,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      level: profile.level,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
}

function sanitizePortableContest(value: unknown) {
  const contest = record(value);
  return {
    id: contest.id,
    title: contest.title,
    slug: contest.slug,
    description: contest.description,
    contestType: contest.contestType,
    status: contest.status,
    visibility: contest.visibility,
    accessCodeUpdatedAt: contest.accessCodeUpdatedAt,
    durationMinutes: contest.durationMinutes,
    startsAt: contest.startsAt,
    endsAt: contest.endsAt,
    sourceName: contest.sourceName,
    rules: contest.rules,
    createdById: contest.createdById,
    createdAt: contest.createdAt,
    updatedAt: contest.updatedAt,
  };
}

/** Returns a fresh portable record and never reproduces unknown legacy JSON keys. */
export function sanitizePortableDiagnosticAttempt<T extends PortableDiagnosticSource>(attempt: T) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    score: attempt.score,
    total: attempt.total,
    estimatedLevel: attempt.estimatedLevel,
    skillBreakdownJson: sanitizeDiagnosticSkillBreakdown(attempt.skillBreakdownJson),
    topicBreakdownJson: sanitizeDiagnosticTopicBreakdown(attempt.topicBreakdownJson),
    recommendationJson: sanitizeDiagnosticAttemptMetadata(attempt.recommendationJson),
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

/** Final file boundary used immediately before JSON serialization. */
export function preparePortableExportArtifact(fileName: string, data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  if (fileName === "users.safe.json") return data.map(sanitizePortableUser);
  if (fileName === "contests.json") return data.map(sanitizePortableContest);
  if (fileName === "diagnostic-attempts.json") {
    return data.map((attempt) => sanitizePortableDiagnosticAttempt(record(attempt)));
  }
  return data;
}

export function serializePortableExportArtifact(fileName: string, data: unknown) {
  return JSON.stringify(preparePortableExportArtifact(fileName, data), null, 2);
}

export type PortableImportArguments = {
  inputDir: string;
  targetUrl: string;
  dryRun: boolean;
  yes: boolean;
};

export function parsePortableImportArguments(args: readonly string[]):
  | { ok: true; value: PortableImportArguments }
  | { ok: false } {
  let inputDir = "";
  let targetUrl = "";
  let dryRun = false;
  let yes = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--input", "--url", "--dry-run", "--yes"].includes(flag) || seen.has(flag)) return { ok: false };
    seen.add(flag);
    if (flag === "--input" || flag === "--url") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) return { ok: false };
      if (flag === "--input") inputDir = value;
      else targetUrl = value;
      index += 1;
    } else if (flag === "--dry-run") dryRun = true;
    else yes = true;
  }
  return inputDir ? { ok: true, value: { inputDir, targetUrl, dryRun, yes } } : { ok: false };
}

export async function authorizePortableImportExecution(
  input: { dryRun: boolean; yes: boolean; isTTY: boolean },
  confirmInteractive: () => Promise<boolean>,
): Promise<"dry-run" | "live" | "rejected" | "aborted"> {
  if (input.dryRun) return "dry-run";
  if (input.yes) return "live";
  if (!input.isTTY) return "rejected";
  return await confirmInteractive() ? "live" : "aborted";
}

export async function createAuthorizedPortableImportRuntime<T>(
  input: { dryRun: boolean; yes: boolean; isTTY: boolean },
  dependencies: { confirmInteractive: () => Promise<boolean>; createClient: () => T },
): Promise<
  | { mode: "dry-run" }
  | { mode: "rejected" }
  | { mode: "aborted" }
  | { mode: "live"; client: T }
> {
  const mode = await authorizePortableImportExecution(input, dependencies.confirmInteractive);
  return mode === "live" ? { mode, client: dependencies.createClient() } : { mode };
}
