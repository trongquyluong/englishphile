import type { ContestStatus, ContestType, ContestVisibility } from "@prisma/client";
import {
  evaluateAccessGrant,
  type AccessGrantSnapshot,
} from "@/lib/security/access-grant-decision";

export type ContestAvailabilitySnapshot = {
  contestType: ContestType;
  status: ContestStatus;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type LockedContestStartSnapshot = ContestAvailabilitySnapshot & {
  id: string;
  visibility: ContestVisibility;
  accessCodeUpdatedAt: Date | null;
};

export type ContestAvailabilityDecision = {
  canStart: boolean;
  reason: string;
};

export function getContestAvailabilityDecision(
  contest: ContestAvailabilitySnapshot,
  now = new Date(),
): ContestAvailabilityDecision {
  if (contest.status === "DRAFT" || contest.status === "ARCHIVED") {
    return { canStart: false, reason: "Contest chưa mở công khai." };
  }

  if (contest.contestType === "LIVE_CONTEST") {
    if (contest.startsAt && contest.startsAt.getTime() > now.getTime()) {
      return { canStart: false, reason: "Contest chưa đến giờ bắt đầu." };
    }
    if (
      contest.status === "ENDED" ||
      (contest.endsAt && contest.endsAt.getTime() <= now.getTime())
    ) {
      return { canStart: false, reason: "Contest đã kết thúc." };
    }
    return { canStart: true, reason: "Contest đang mở." };
  }

  if (contest.startsAt && contest.startsAt.getTime() > now.getTime()) {
    return { canStart: false, reason: "Contest chưa đến giờ mở." };
  }

  return {
    canStart: true,
    reason: contest.status === "ENDED" ? "Đề cũ vẫn có thể luyện lại." : "Có thể bắt đầu.",
  };
}

export type LockedContestStartDecision =
  | { allowed: true }
  | { allowed: false; reason: "unavailable" | "no-content" | "private-access"; message: string };

/**
 * Authoritative policy evaluated from the Contest row held FOR UPDATE.
 * The caller must evaluate this before looking up an existing IN_PROGRESS
 * attempt, so resuming and creating follow the same current-state policy.
 */
export function evaluateLockedContestStart(
  contest: LockedContestStartSnapshot,
  request: {
    userId: string;
    now: Date;
    hasContent: boolean;
    bypassPrivateAccess: boolean;
    grant: AccessGrantSnapshot | null;
  },
): LockedContestStartDecision {
  const availability = getContestAvailabilityDecision(contest, request.now);
  if (!availability.canStart) {
    return { allowed: false, reason: "unavailable", message: availability.reason };
  }

  if (!request.hasContent) {
    return {
      allowed: false,
      reason: "no-content",
      message: "Contest chưa có nội dung để bắt đầu.",
    };
  }

  if (contest.visibility === "PRIVATE" && !request.bypassPrivateAccess) {
    const grantDecision = evaluateAccessGrant(request.grant, {
      userId: request.userId,
      contestId: contest.id,
      now: request.now,
    });
    if (!grantDecision.valid) {
      return {
        allowed: false,
        reason: "private-access",
        message: "Bạn cần nhập mã truy cập để vào contest riêng tư này.",
      };
    }
  }

  return { allowed: true };
}
