export const MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS = 100;

export function parseContestSectionPlaceholderCount(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!/^(0|[1-9]\d*)$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS) return null;
  return parsed;
}
