import { describe, expect, it } from "vitest";
import {
  applySuccessfulWritingGrade,
  createWritingFormContentState,
  discardWritingDraft,
  preserveFailedWritingDraft,
  reconcileWritingDraft,
  restoreFailedWritingDraft,
  restoreLatestWritingReview,
} from "@/lib/writing-grader-form-state";
import type {
  WritingGradeResult,
  WritingReviewData,
} from "@/lib/writing-grader-shared";
import {
  WRITING_DRAFT_VERSION,
  type WritingDraft,
} from "@/lib/writing-draft";

const olderResult: WritingGradeResult = {
  totalScore: 20,
  maxScore: 30,
  criteria: {
    content: { score: 6, maxScore: 9, comment: "Đủ ý." },
    organization: { score: 6, maxScore: 9, comment: "Bố cục rõ." },
    language: { score: 6, maxScore: 9, comment: "Khá chính xác." },
    mechanics: { score: 2, maxScore: 3, comment: "Ít lỗi." },
  },
  overallComment: "Bài cũ đã được chấm.",
  strengths: [],
  priorityIssues: [],
  detailedFeedback: [],
  nextPracticeTasks: [],
  warnings: [],
};

const latestResult: WritingGradeResult = {
  ...olderResult,
  totalScore: 24,
  overallComment: "Bài mới đã được chấm.",
};

const initialReview: WritingReviewData = {
  essayText: "This is the older successfully graded essay.",
  targetWordCount: "250-300",
  result: olderResult,
  reviewTimestamp: 900,
};

const failedDraft: WritingDraft = {
  version: WRITING_DRAFT_VERSION,
  essayText: "This is the newer essay whose grading request failed.",
  targetWordCount: "300-350",
  timestamp: 1_000,
};

describe("Writing grader form content state", () => {
  it("restores a newer failed draft without inheriting an older grade", () => {
    const decision = reconcileWritingDraft(
      createWritingFormContentState(initialReview),
      failedDraft,
    );
    const restored = decision.state;

    expect(decision.staleDraft).toBe(false);
    expect(restored).toMatchObject({
      essayText: failedDraft.essayText,
      targetWordCount: failedDraft.targetWordCount,
      result: null,
      reviewingStoredResult: false,
      draftActive: true,
      draftRestored: true,
    });
    expect(initialReview.result).toBe(olderResult);
  });

  it("keeps a newer persisted review authoritative over an older failed draft", () => {
    const decision = reconcileWritingDraft(
      createWritingFormContentState(initialReview),
      { ...failedDraft, timestamp: initialReview.reviewTimestamp - 1 },
    );

    expect(decision.staleDraft).toBe(true);
    expect(decision.state).toMatchObject({
      essayText: initialReview.essayText,
      result: olderResult,
      reviewingStoredResult: true,
      draftActive: false,
    });
  });

  it("lets the persisted review win when timestamps are equal", () => {
    const decision = reconcileWritingDraft(
      createWritingFormContentState(initialReview),
      { ...failedDraft, timestamp: initialReview.reviewTimestamp },
    );

    expect(decision.staleDraft).toBe(true);
    expect(decision.state.result).toBe(olderResult);
    expect(decision.state.essayText).toBe(initialReview.essayText);
  });

  it("detaches a previously visible result as soon as a grading request fails", () => {
    const failed = preserveFailedWritingDraft(
      createWritingFormContentState(initialReview),
      true,
    );

    expect(failed.result).toBeNull();
    expect(failed.reviewingStoredResult).toBe(false);
    expect(failed.draftActive).toBe(true);
  });

  it("discarding only the draft restores the latest server-backed review", () => {
    const restoredDraft = restoreFailedWritingDraft(
      createWritingFormContentState(initialReview),
      failedDraft,
    );
    const discard = discardWritingDraft(restoredDraft, true);
    const review = discard.state;

    expect(restoredDraft.result).toBeNull();
    expect(discard.discarded).toBe(true);
    expect(discard.error).toBeNull();
    expect(review).toMatchObject({
      essayText: initialReview.essayText,
      result: olderResult,
      reviewingStoredResult: true,
      draftActive: false,
    });
  });

  it("restores a successful grade returned in the current page session", () => {
    const currentSuccess = applySuccessfulWritingGrade(
      createWritingFormContentState(initialReview),
      latestResult,
      1_100,
    );
    const edited = {
      ...currentSuccess,
      essayText: failedDraft.essayText,
      targetWordCount: failedDraft.targetWordCount,
    };
    const failed = preserveFailedWritingDraft(edited, true);
    const restoredReview = restoreLatestWritingReview(failed);

    expect(failed.result).toBeNull();
    expect(restoredReview).toMatchObject({
      essayText: initialReview.essayText,
      targetWordCount: initialReview.targetWordCount,
      result: latestResult,
      reviewingStoredResult: true,
    });
  });

  it("keeps the current draft when browser deletion is not confirmed", () => {
    const restoredDraft = restoreFailedWritingDraft(
      createWritingFormContentState(initialReview),
      failedDraft,
    );
    const discard = discardWritingDraft(restoredDraft, false);

    expect(discard.discarded).toBe(false);
    expect(discard.error).toBe("Chưa thể bỏ bản nháp. Vui lòng thử lại.");
    expect(discard.state).toBe(restoredDraft);
    expect(discard.state.result).toBeNull();
    expect(discard.state.essayText).toBe(failedDraft.essayText);
  });

  it("makes a successful server result authoritative before draft cleanup", () => {
    const success = applySuccessfulWritingGrade(
      restoreFailedWritingDraft(
        createWritingFormContentState(initialReview),
        failedDraft,
      ),
      latestResult,
      1_100,
    );

    expect(success.result).toBe(latestResult);
    expect(success.latestSuccessfulReview?.reviewTimestamp).toBe(1_100);
    expect(success.reviewingStoredResult).toBe(false);
    expect(success.draftActive).toBe(false);
  });
});
