import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clearWritingDraft,
  getSafeSessionStorage,
  loadWritingDraft,
  saveWritingDraft,
  WRITING_DRAFT_MAX_AGE_MS,
  WRITING_DRAFT_VERSION,
} from "@/lib/writing-draft";
import {
  applySuccessfulWritingGrade,
  createWritingFormContentState,
  discardWritingDraft,
  preserveFailedWritingDraft,
  reconcileWritingDraft,
} from "@/lib/writing-grader-form-state";
import type {
  WritingGradeResult,
  WritingReviewData,
} from "@/lib/writing-grader-shared";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ThrowingRemoveStorage extends MemoryStorage {
  override removeItem(_key: string): void {
    void _key;
    throw new Error("SENSITIVE-REMOVE-SENTINEL");
  }
}

const firstUserKey = "a".repeat(43);
const secondUserKey = "b".repeat(43);
const essayText =
  "Students can improve their writing by planning each paragraph and checking their evidence carefully. ".repeat(
    10,
  );

const successfulResult: WritingGradeResult = {
  totalScore: 22,
  maxScore: 30,
  criteria: {
    content: { score: 7, maxScore: 9, comment: "Đủ ý." },
    organization: { score: 7, maxScore: 9, comment: "Rõ ràng." },
    language: { score: 6, maxScore: 9, comment: "Khá chính xác." },
    mechanics: { score: 2, maxScore: 3, comment: "Ít lỗi." },
  },
  overallComment: "Kết quả đã lưu.",
  strengths: [],
  priorityIssues: [],
  detailedFeedback: [],
  nextPracticeTasks: [],
  warnings: [],
};

const successfulReview: WritingReviewData = {
  essayText,
  targetWordCount: "250-300",
  result: successfulResult,
  reviewTimestamp: 2_000,
};

function storageAccessThrows(): { readonly sessionStorage: Storage } {
  return Object.defineProperty({}, "sessionStorage", {
    get() {
      throw new Error("SENSITIVE-STORAGE-ACCESS-SENTINEL");
    },
  }) as { readonly sessionStorage: Storage };
}

describe("Writing failed-grade session draft", () => {
  it("restores the bounded draft after refresh or navigation in one session", () => {
    const storage = new MemoryStorage();
    const timestamp = Date.parse("2026-07-28T12:00:00.000Z");

    expect(
      saveWritingDraft(
        storage,
        firstUserKey,
        { essayText, targetWordCount: "250-300" },
        timestamp,
      ),
    ).toBe(true);

    const restored = loadWritingDraft(
      storage,
      firstUserKey,
      timestamp + 60_000,
    );
    expect(restored).toEqual({
      version: WRITING_DRAFT_VERSION,
      essayText,
      targetWordCount: "250-300",
      timestamp,
    });

    const storedPayload = JSON.parse([...storage.values.values()][0]) as object;
    expect(Object.keys(storedPayload).sort()).toEqual([
      "essayText",
      "targetWordCount",
      "timestamp",
      "version",
    ]);
  });

  it.each([
    { label: "malformed", value: "not-json" },
    {
      label: "oversized",
      value: JSON.stringify({
        version: WRITING_DRAFT_VERSION,
        essayText: "x".repeat(30_001),
        targetWordCount: "250-300",
        timestamp: 100,
      }),
    },
    {
      label: "disallowed target",
      value: JSON.stringify({
        version: WRITING_DRAFT_VERSION,
        essayText,
        targetWordCount: "arbitrary",
        timestamp: 100,
      }),
    },
  ])("discards a $label draft", ({ value }) => {
    const storage = new MemoryStorage();
    storage.values.set(
      `englishphile:writing-draft:${firstUserKey}`,
      value,
    );

    expect(loadWritingDraft(storage, firstUserKey, 200)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("discards drafts after at most 24 hours", () => {
    const storage = new MemoryStorage();
    expect(
      saveWritingDraft(
        storage,
        firstUserKey,
        { essayText, targetWordCount: "250-300" },
        1_000,
      ),
    ).toBe(true);

    expect(
      loadWritingDraft(
        storage,
        firstUserKey,
        1_000 + WRITING_DRAFT_MAX_AGE_MS + 1,
      ),
    ).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("does not restore one authenticated user's draft under another opaque key", () => {
    const storage = new MemoryStorage();
    expect(
      saveWritingDraft(
        storage,
        firstUserKey,
        { essayText, targetWordCount: "250-300" },
        1_000,
      ),
    ).toBe(true);

    expect(loadWritingDraft(storage, secondUserKey, 2_000)).toBeNull();
    expect(loadWritingDraft(storage, firstUserKey, 2_000)?.essayText).toBe(
      essayText,
    );
  });

  it("clears the draft after a successful grade response", () => {
    const storage = new MemoryStorage();
    saveWritingDraft(
      storage,
      firstUserKey,
      { essayText, targetWordCount: "250-300" },
      1_000,
    );

    clearWritingDraft(storage, firstUserKey);

    expect(loadWritingDraft(storage, firstUserKey, 2_000)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("keeps an existing successful review visible when initial storage access throws", () => {
    const storage = getSafeSessionStorage(storageAccessThrows());
    const state = createWritingFormContentState(successfulReview);

    expect(storage).toBeNull();
    expect(loadWritingDraft(storage, firstUserKey)).toBeNull();
    expect(state.result).toBe(successfulResult);
    expect(state.reviewingStoredResult).toBe(true);
  });

  it("tolerates storage access throwing while preserving a failed response", () => {
    const current = createWritingFormContentState(successfulReview);
    const storage = getSafeSessionStorage(storageAccessThrows());
    const saved = saveWritingDraft(storage, firstUserKey, {
      essayText,
      targetWordCount: "250-300",
    });
    const failed = preserveFailedWritingDraft(current, saved);

    expect(saved).toBe(false);
    expect(failed.result).toBeNull();
    expect(failed.essayText).toBe(essayText);
    expect(successfulReview.result).toBe(successfulResult);
  });

  it("keeps a newly successful grade visible when draft cleanup cannot access storage", () => {
    const nextResult = {
      ...successfulResult,
      totalScore: 25,
      overallComment: "Kết quả mới đã được lưu.",
    };
    const success = applySuccessfulWritingGrade(
      createWritingFormContentState(successfulReview),
      nextResult,
      3_000,
    );
    const storage = getSafeSessionStorage(storageAccessThrows());

    expect(clearWritingDraft(storage, firstUserKey)).toBe(false);
    expect(success.result).toBe(nextResult);
    expect(success.reviewingStoredResult).toBe(false);
  });

  it("keeps a successful retry authoritative after failed cleanup and refresh", () => {
    const storage = new ThrowingRemoveStorage();
    saveWritingDraft(
      storage,
      firstUserKey,
      { essayText, targetWordCount: "250-300" },
      1_000,
    );
    const nextResult = {
      ...successfulResult,
      totalScore: 26,
      overallComment: "Kết quả thử lại đã được lưu.",
    };
    const success = applySuccessfulWritingGrade(
      createWritingFormContentState(successfulReview),
      nextResult,
      3_000,
    );

    expect(clearWritingDraft(storage, firstUserKey)).toBe(false);
    const retainedDraft = loadWritingDraft(storage, firstUserKey, 4_000);
    expect(retainedDraft).not.toBeNull();
    const refreshDecision = reconcileWritingDraft(
      createWritingFormContentState(success.latestSuccessfulReview),
      retainedDraft!,
    );

    expect(refreshDecision.staleDraft).toBe(true);
    expect(refreshDecision.state.result).toBe(nextResult);
    expect(refreshDecision.state.reviewingStoredResult).toBe(true);
  });

  it("restores the latest review only after confirmed browser-draft deletion", () => {
    const storage = new MemoryStorage();
    saveWritingDraft(
      storage,
      firstUserKey,
      { essayText, targetWordCount: "250-300" },
      3_000,
    );
    const draft = loadWritingDraft(storage, firstUserKey, 4_000)!;
    const draftState = reconcileWritingDraft(
      createWritingFormContentState(successfulReview),
      draft,
    ).state;
    const deletionConfirmed = clearWritingDraft(storage, firstUserKey);
    const discard = discardWritingDraft(draftState, deletionConfirmed);

    expect(deletionConfirmed).toBe(true);
    expect(discard.discarded).toBe(true);
    expect(discard.state.result).toBe(successfulResult);
    expect(discard.state.essayText).toBe(successfulReview.essayText);
  });

  it("keeps the draft and reports a generic message when removeItem throws", () => {
    const storage = new ThrowingRemoveStorage();
    saveWritingDraft(
      storage,
      firstUserKey,
      { essayText, targetWordCount: "250-300" },
      3_000,
    );
    const draft = loadWritingDraft(storage, firstUserKey, 4_000)!;
    const draftState = reconcileWritingDraft(
      createWritingFormContentState(successfulReview),
      draft,
    ).state;
    const deletionConfirmed = clearWritingDraft(storage, firstUserKey);
    const discard = discardWritingDraft(draftState, deletionConfirmed);

    expect(deletionConfirmed).toBe(false);
    expect(discard.discarded).toBe(false);
    expect(discard.state.essayText).toBe(draft.essayText);
    expect(discard.state.result).toBeNull();
    expect(discard.error).toBe("Chưa thể bỏ bản nháp. Vui lòng thử lại.");
    expect(discard.error).not.toContain("SENSITIVE-REMOVE-SENTINEL");
  });

  it("integrates only with sessionStorage in the Client Component", () => {
    const source = readFileSync(
      "src/components/writing/WritingGraderForm.tsx",
      "utf8",
    );
    expect(source).toContain("getSafeSessionStorage(window)");
    expect(source).not.toContain("window.sessionStorage");
    expect(source).not.toContain("localStorage");
    expect(source).toContain("preserveCurrentDraft();");
    expect(source).toContain(
      "clearWritingDraft(getSafeSessionStorage(window), draftKey);",
    );
    expect(source).toContain("Đã khôi phục bản nháp chưa được chấm.");
    expect(source).not.toContain("Đã nộp");
  });
});
