import {
  DEFAULT_TARGET_WORD_COUNT,
  type TargetWordCount,
  type WritingGradeResult,
  type WritingReviewData,
} from "@/lib/writing-grader-shared";
import type { WritingDraft } from "@/lib/writing-draft";

export const WRITING_DRAFT_DISCARD_ERROR =
  "Chưa thể bỏ bản nháp. Vui lòng thử lại.";

export type WritingFormContentState = {
  essayText: string;
  targetWordCount: TargetWordCount;
  result: WritingGradeResult | null;
  reviewingStoredResult: boolean;
  latestSuccessfulReview: WritingReviewData | null;
  draftActive: boolean;
  draftRestored: boolean;
};

export function createWritingFormContentState(
  initialReview: WritingReviewData | null,
): WritingFormContentState {
  return {
    essayText: initialReview?.essayText ?? "",
    targetWordCount:
      initialReview?.targetWordCount ?? DEFAULT_TARGET_WORD_COUNT,
    result: initialReview?.result ?? null,
    reviewingStoredResult: Boolean(initialReview),
    latestSuccessfulReview: initialReview,
    draftActive: false,
    draftRestored: false,
  };
}

export function restoreFailedWritingDraft(
  current: WritingFormContentState,
  draft: WritingDraft,
): WritingFormContentState {
  return {
    ...current,
    essayText: draft.essayText,
    targetWordCount: draft.targetWordCount,
    result: null,
    reviewingStoredResult: false,
    draftActive: true,
    draftRestored: true,
  };
}

export function reconcileWritingDraft(
  current: WritingFormContentState,
  draft: WritingDraft,
): {
  state: WritingFormContentState;
  staleDraft: boolean;
} {
  const latestTimestamp = current.latestSuccessfulReview?.reviewTimestamp;
  if (latestTimestamp !== undefined && draft.timestamp <= latestTimestamp) {
    return {
      state: current,
      staleDraft: true,
    };
  }
  return {
    state: restoreFailedWritingDraft(current, draft),
    staleDraft: false,
  };
}

export function preserveFailedWritingDraft(
  current: WritingFormContentState,
  draftSaved: boolean,
): WritingFormContentState {
  return {
    ...current,
    result: null,
    reviewingStoredResult: false,
    draftActive: draftSaved || current.draftActive,
    draftRestored: false,
  };
}

export function restoreLatestWritingReview(
  current: WritingFormContentState,
): WritingFormContentState {
  return createWritingFormContentState(current.latestSuccessfulReview);
}

export function discardWritingDraft(
  current: WritingFormContentState,
  deletionConfirmed: boolean,
): {
  state: WritingFormContentState;
  discarded: boolean;
  error: string | null;
} {
  if (!deletionConfirmed) {
    return {
      state: current,
      discarded: false,
      error: WRITING_DRAFT_DISCARD_ERROR,
    };
  }
  return {
    state: restoreLatestWritingReview(current),
    discarded: true,
    error: null,
  };
}

export function applySuccessfulWritingGrade(
  current: WritingFormContentState,
  result: WritingGradeResult,
  reviewTimestamp: number,
): WritingFormContentState {
  const latestSuccessfulReview: WritingReviewData = {
    essayText: current.essayText,
    targetWordCount: current.targetWordCount,
    result,
    reviewTimestamp,
  };
  return {
    ...current,
    result,
    reviewingStoredResult: false,
    latestSuccessfulReview,
    draftActive: false,
    draftRestored: false,
  };
}
