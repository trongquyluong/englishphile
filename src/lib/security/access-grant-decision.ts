export type AccessGrantSnapshot = {
  userId: string;
  contestId: string;
  expiresAt: Date;
  createdAt: Date;
  contest: { id: string; accessCodeUpdatedAt: Date | null } | null;
};

export type AccessGrantDecision =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "grant-not-found"
        | "wrong-user"
        | "wrong-contest"
        | "expired"
        | "contest-deleted"
        | "access-code-changed";
    };

export function evaluateAccessGrant(
  grant: AccessGrantSnapshot | null,
  request: { userId: string; contestId: string; now: Date },
): AccessGrantDecision {
  if (grant === null) return { valid: false, reason: "grant-not-found" };
  if (grant.userId !== request.userId) return { valid: false, reason: "wrong-user" };
  if (grant.contestId !== request.contestId) return { valid: false, reason: "wrong-contest" };
  if (grant.expiresAt.getTime() <= request.now.getTime()) {
    return { valid: false, reason: "expired" };
  }
  if (grant.contest === null || grant.contest.id !== request.contestId) {
    return { valid: false, reason: "contest-deleted" };
  }
  if (
    grant.contest.accessCodeUpdatedAt !== null &&
    grant.createdAt.getTime() < grant.contest.accessCodeUpdatedAt.getTime()
  ) {
    return { valid: false, reason: "access-code-changed" };
  }
  return { valid: true };
}
