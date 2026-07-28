import {
  countWords,
  targetWordCountValues,
  WRITING_GRADER_MAX_ESSAY_CHARS,
  WRITING_GRADER_MAX_WORDS,
  WRITING_GRADER_MIN_WORDS,
  type TargetWordCount,
} from "@/lib/writing-grader-shared";

export const WRITING_DRAFT_VERSION = 1;
export const WRITING_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const WRITING_DRAFT_STORAGE_PREFIX = "englishphile:writing-draft:";
const OPAQUE_DRAFT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type WritingDraft = {
  version: typeof WRITING_DRAFT_VERSION;
  essayText: string;
  targetWordCount: TargetWordCount;
  timestamp: number;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type SessionStorageHost = {
  readonly sessionStorage: Storage;
};

export function getSafeSessionStorage(
  host: SessionStorageHost | null | undefined,
): Storage | null {
  if (!host) return null;
  try {
    return host.sessionStorage;
  } catch {
    return null;
  }
}

function getStorageKey(opaqueKey: string | null): string | null {
  return opaqueKey && OPAQUE_DRAFT_KEY_PATTERN.test(opaqueKey)
    ? `${WRITING_DRAFT_STORAGE_PREFIX}${opaqueKey}`
    : null;
}

function isAllowedTargetWordCount(value: unknown): value is TargetWordCount {
  return (
    typeof value === "string" &&
    targetWordCountValues.includes(value as TargetWordCount)
  );
}

function isAllowedEssay(essayText: unknown): essayText is string {
  if (
    typeof essayText !== "string" ||
    essayText.length === 0 ||
    essayText.length > WRITING_GRADER_MAX_ESSAY_CHARS
  ) {
    return false;
  }
  const wordCount = countWords(essayText);
  return (
    wordCount >= WRITING_GRADER_MIN_WORDS &&
    wordCount <= WRITING_GRADER_MAX_WORDS
  );
}

function removeDraft(storage: DraftStorage, storageKey: string): boolean {
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    // Browser storage may be unavailable. Draft recovery remains best-effort.
    return false;
  }
}

export function saveWritingDraft(
  storage: DraftStorage | null,
  opaqueKey: string | null,
  input: Pick<WritingDraft, "essayText" | "targetWordCount">,
  now = Date.now(),
): boolean {
  const storageKey = getStorageKey(opaqueKey);
  if (
    !storage ||
    !storageKey ||
    !isAllowedEssay(input.essayText) ||
    !isAllowedTargetWordCount(input.targetWordCount) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    return false;
  }

  const draft: WritingDraft = {
    version: WRITING_DRAFT_VERSION,
    essayText: input.essayText,
    targetWordCount: input.targetWordCount,
    timestamp: now,
  };

  try {
    storage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadWritingDraft(
  storage: DraftStorage | null,
  opaqueKey: string | null,
  now = Date.now(),
): WritingDraft | null {
  const storageKey = getStorageKey(opaqueKey);
  if (!storage || !storageKey || !Number.isSafeInteger(now) || now < 0) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      removeDraft(storage, storageKey);
      return null;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (
      keys.length !== 4 ||
      keys[0] !== "essayText" ||
      keys[1] !== "targetWordCount" ||
      keys[2] !== "timestamp" ||
      keys[3] !== "version" ||
      record.version !== WRITING_DRAFT_VERSION ||
      !isAllowedEssay(record.essayText) ||
      !isAllowedTargetWordCount(record.targetWordCount) ||
      !Number.isSafeInteger(record.timestamp) ||
      (record.timestamp as number) < 0 ||
      (record.timestamp as number) > now ||
      now - (record.timestamp as number) > WRITING_DRAFT_MAX_AGE_MS
    ) {
      removeDraft(storage, storageKey);
      return null;
    }

    return {
      version: WRITING_DRAFT_VERSION,
      essayText: record.essayText,
      targetWordCount: record.targetWordCount,
      timestamp: record.timestamp as number,
    };
  } catch {
    removeDraft(storage, storageKey);
    return null;
  }
}

export function clearWritingDraft(
  storage: DraftStorage | null,
  opaqueKey: string | null,
): boolean {
  const storageKey = getStorageKey(opaqueKey);
  return Boolean(storage && storageKey && removeDraft(storage, storageKey));
}
