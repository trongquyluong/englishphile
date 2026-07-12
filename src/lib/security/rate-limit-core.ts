import { createHash } from "node:crypto";

export type RateLimitResult =
  | { status: "allowed"; remaining: number; retryAfterSeconds: number }
  | { status: "rate-limited"; remaining: number; retryAfterSeconds: number }
  | { status: "infrastructure-error"; retryAfterSeconds: number };

export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

export type RateLimitAuthorizationInput = {
  action: string;
  subject: string;
  limit: number;
  now: Date;
  expiresAt: Date;
};

export type RateLimitAuthorization = {
  count: number | bigint;
  expiresAt: Date;
};

export type RateLimitAuthorizationStore = {
  authorize(input: RateLimitAuthorizationInput): Promise<RateLimitAuthorization | null>;
};

type RateLimitLogger = Pick<Console, "error">;

const MAX_ACTION_LENGTH = 160;
const MAX_SUBJECT_LENGTH = 256;
const MAX_LIMIT = 1_000_000;
const MAX_WINDOW_SECONDS = 365 * 24 * 60 * 60;
const INFRASTRUCTURE_RETRY_SECONDS = 30;

export function validateRateLimitPolicy(policy: RateLimitPolicy): boolean {
  return (
    Number.isInteger(policy.limit) &&
    policy.limit >= 1 &&
    policy.limit <= MAX_LIMIT &&
    Number.isInteger(policy.windowSeconds) &&
    policy.windowSeconds >= 1 &&
    policy.windowSeconds <= MAX_WINDOW_SECONDS
  );
}

function hasValidBucketKey(action: string, subject: string): boolean {
  return (
    action.length >= 1 &&
    action.length <= MAX_ACTION_LENGTH &&
    subject.length >= 1 &&
    subject.length <= MAX_SUBJECT_LENGTH
  );
}

/**
 * Hash account identifiers before using them as database rate-limit subjects.
 * The database stores only a deterministic digest, never the email or password.
 */
export function hashRateLimitSubject(identifier: string): string {
  return `sha256:${createHash("sha256").update(identifier.trim().toLowerCase(), "utf8").digest("hex")}`;
}

export function createDbRateLimitChecker(
  store: RateLimitAuthorizationStore,
  options: { now?: () => Date; logger?: RateLimitLogger } = {},
) {
  const nowFactory = options.now ?? (() => new Date());
  const logger = options.logger ?? console;

  return async function checkRateLimit(
    action: string,
    subject: string,
    policy: RateLimitPolicy,
  ): Promise<RateLimitResult> {
    if (!validateRateLimitPolicy(policy) || !hasValidBucketKey(action, subject)) {
      logger.error("[rate-limit] Invalid policy or bucket key for action:", action);
      return { status: "infrastructure-error", retryAfterSeconds: INFRASTRUCTURE_RETRY_SECONDS };
    }

    const now = nowFactory();
    const expiresAt = new Date(now.getTime() + policy.windowSeconds * 1000);

    try {
      const authorization = await store.authorize({
        action,
        subject,
        limit: policy.limit,
        now,
        expiresAt,
      });

      if (authorization === null) {
        return {
          status: "rate-limited",
          remaining: 0,
          retryAfterSeconds: policy.windowSeconds,
        };
      }

      return {
        status: "allowed",
        remaining: Math.max(0, policy.limit - Number(authorization.count)),
        retryAfterSeconds: 0,
      };
    } catch (error) {
      logger.error(
        "[rate-limit] Authorization infrastructure error:",
        error instanceof Error ? error.name : "unknown",
      );
      return { status: "infrastructure-error", retryAfterSeconds: INFRASTRUCTURE_RETRY_SECONDS };
    }
  };
}
