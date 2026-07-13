import { describe, expect, it, vi } from "vitest";
import {
  createDbRateLimitChecker,
  hashRateLimitSubject,
  validateRateLimitPolicy,
  type RateLimitAuthorizationInput,
  type RateLimitAuthorizationStore,
} from "@/lib/security/rate-limit-core";
import {
  createWritingQuotaReserver,
  getUtcQuotaKey,
  type WritingSlotStore,
} from "@/lib/security/writing-quota-core";
import { constantTimeEquals, MAX_ACCESS_CODE_BYTES, verifyAccessCode } from "@/lib/security/access-code";
import { evaluateAccessGrant, type AccessGrantSnapshot } from "@/lib/security/access-grant-decision";
import {
  evaluateLockedContestStart,
  getContestAvailabilityDecision,
  type LockedContestStartSnapshot,
} from "@/lib/security/contest-start-decision";
import { validateOriginDecision } from "@/lib/security/request-origin-decision";
import { claimSingleWinner, runSingleWinnerTransaction } from "@/lib/security/replay-guard";
import { parseContestAnswerEntries, parseDiagnosticAnswerEntries } from "@/lib/security/submission-input";
import {
  createLoginPasswordVerifier,
  DUMMY_PASSWORD_HASH_VALUE,
  verifyPassword,
} from "@/lib/auth/password";

class AtomicRateLimitStore implements RateLimitAuthorizationStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: Date }>();

  async authorize(input: RateLimitAuthorizationInput) {
    const key = `${input.action}\u0000${input.subject}`;
    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt.getTime() <= input.now.getTime()) {
      const created = { count: 1, expiresAt: input.expiresAt };
      this.buckets.set(key, created);
      return created;
    }
    if (existing.count >= input.limit) return null;
    existing.count += 1;
    return existing;
  }

  count(action: string, subject: string) {
    return this.buckets.get(`${action}\u0000${subject}`)?.count ?? 0;
  }
}

class AtomicWritingSlotStore implements WritingSlotStore {
  private readonly slots = new Map<string, { id: string }>();

  async tryCreateSlot(input: {
    userId: string;
    quotaKey: string;
    slotNumber: number;
    expiresAt: Date;
  }) {
    const key = `${input.userId}:${input.quotaKey}:${input.slotNumber}`;
    if (this.slots.has(key)) return null;
    const reservation = { id: `reservation-${this.slots.size + 1}` };
    this.slots.set(key, reservation);
    return reservation;
  }

}

describe("production access-code comparison", () => {
  it("accepts normalized equal values", () => {
    expect(constantTimeEquals(" abc123 ", "ABC123")).toBe(true);
  });

  it("rejects unequal values and unequal lengths", () => {
    expect(constantTimeEquals("ABC123", "ABC124")).toBe(false);
    expect(constantTimeEquals("A", "AA")).toBe(false);
  });

  it("rejects the NUL-padding regression", () => {
    expect(constantTimeEquals("A", "A\u0000")).toBe(false);
    expect(constantTimeEquals("ABC", "ABC\u0000")).toBe(false);
  });

  it("bounds raw and normalized input", () => {
    expect(constantTimeEquals("A".repeat(MAX_ACCESS_CODE_BYTES + 1), "A")).toBe(false);
  });

  it("rejects an absent stored code", () => {
    expect(verifyAccessCode("ABC123", null)).toBe(false);
  });
});

describe("production request-origin decision", () => {
  const trusted = ["https://englishphile.com"];

  it("accepts only an exact trusted origin", () => {
    expect(validateOriginDecision({ origin: trusted[0], secFetchSite: null, secFetchMode: null }, trusted)).toEqual({ valid: true });
  });

  it.each([
    "https://attacker.englishphile.com",
    "https://englishphile.com.attacker.test",
    "http://englishphile.com",
    "https://englishphile.com:8443",
  ])("rejects hostile origin %s", (origin) => {
    expect(validateOriginDecision({ origin, secFetchSite: null, secFetchMode: null }, trusted).valid).toBe(false);
  });

  it("rejects Origin: null", () => {
    expect(validateOriginDecision({ origin: "null", secFetchSite: null, secFetchMode: null }, trusted)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("accepts missing Origin only with same-origin proof", () => {
    expect(validateOriginDecision({ origin: null, secFetchSite: "same-origin", secFetchMode: "cors" }, trusted)).toEqual({ valid: true });
    expect(validateOriginDecision({ origin: null, secFetchSite: null, secFetchMode: "navigate" }, trusted).valid).toBe(false);
  });

  it("rejects missing Origin plus cross-site navigate", () => {
    expect(validateOriginDecision({ origin: null, secFetchSite: "cross-site", secFetchMode: "navigate" }, trusted)).toEqual({
      valid: false,
      reason: "cross-site",
    });
  });
});

describe("production access-grant decision", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const baseGrant: AccessGrantSnapshot = {
    userId: "user-1",
    contestId: "contest-1",
    createdAt: new Date("2026-07-12T11:00:00.000Z"),
    expiresAt: new Date("2026-07-12T13:00:00.000Z"),
    contest: { id: "contest-1", accessCodeUpdatedAt: null },
  };

  it("accepts a current, correctly scoped grant", () => {
    expect(evaluateAccessGrant(baseGrant, { userId: "user-1", contestId: "contest-1", now })).toEqual({ valid: true });
  });

  it("rejects a missing contest or grant", () => {
    expect(evaluateAccessGrant(null, { userId: "user-1", contestId: "contest-1", now }).valid).toBe(false);
    expect(evaluateAccessGrant({ ...baseGrant, contest: null }, { userId: "user-1", contestId: "contest-1", now }).valid).toBe(false);
  });

  it("rejects wrong-user and wrong-contest grants", () => {
    expect(evaluateAccessGrant(baseGrant, { userId: "user-2", contestId: "contest-1", now })).toMatchObject({ valid: false, reason: "wrong-user" });
    expect(evaluateAccessGrant(baseGrant, { userId: "user-1", contestId: "contest-2", now })).toMatchObject({ valid: false, reason: "wrong-contest" });
  });

  it("rejects expiry at the exact boundary", () => {
    expect(evaluateAccessGrant({ ...baseGrant, expiresAt: now }, { userId: "user-1", contestId: "contest-1", now })).toMatchObject({ valid: false, reason: "expired" });
  });

  it("rejects an old grant but accepts equal-time and newer post-mutation grants", () => {
    const mutationTime = new Date("2026-07-12T11:00:00.001Z");
    const contest = { id: "contest-1", accessCodeUpdatedAt: mutationTime };
    expect(evaluateAccessGrant({ ...baseGrant, contest }, { userId: "user-1", contestId: "contest-1", now })).toMatchObject({ valid: false, reason: "access-code-changed" });
    expect(evaluateAccessGrant({ ...baseGrant, createdAt: mutationTime, contest }, { userId: "user-1", contestId: "contest-1", now })).toEqual({ valid: true });
    expect(evaluateAccessGrant({ ...baseGrant, createdAt: new Date("2026-07-12T11:00:00.002Z"), contest }, { userId: "user-1", contestId: "contest-1", now })).toEqual({ valid: true });
  });
});

describe("production locked contest-start decision", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const openContest: LockedContestStartSnapshot = {
    id: "contest-1",
    contestType: "LIVE_CONTEST",
    status: "LIVE",
    startsAt: new Date("2026-07-12T11:00:00.000Z"),
    endsAt: new Date("2026-07-12T13:00:00.000Z"),
    visibility: "PUBLIC",
    accessCodeUpdatedAt: null,
  };
  const request = {
    userId: "user-1",
    now,
    hasContent: true,
    bypassPrivateAccess: false,
    grant: null,
  };

  it("rejects the locked state when an initially open contest was archived", () => {
    expect(getContestAvailabilityDecision(openContest, new Date("2026-07-12T11:30:00.000Z")).canStart).toBe(true);
    expect(evaluateLockedContestStart({ ...openContest, status: "ARCHIVED" }, request)).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it("rejects a live contest that reaches its end before the locked decision", () => {
    expect(evaluateLockedContestStart({ ...openContest, endsAt: now }, request)).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it("rejects a contest whose start remains in the future", () => {
    expect(evaluateLockedContestStart({ ...openContest, startsAt: new Date("2026-07-12T12:00:00.001Z") }, request)).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it.each(["PRACTICE_CONTEST", "PAST_EXAM"] as const)(
    "continues to allow ended %s content",
    (contestType) => {
      expect(evaluateLockedContestStart({ ...openContest, contestType, status: "ENDED", endsAt: new Date("2026-07-01T00:00:00.000Z") }, request)).toEqual({ allowed: true });
    },
  );

  it("checks a private grant against the same locked contest mutation boundary", () => {
    const mutationTime = new Date("2026-07-12T11:30:00.000Z");
    const contest = { ...openContest, visibility: "PRIVATE" as const, accessCodeUpdatedAt: mutationTime };
    const oldGrant: AccessGrantSnapshot = {
      userId: request.userId,
      contestId: contest.id,
      createdAt: new Date("2026-07-12T11:29:59.999Z"),
      expiresAt: new Date("2026-07-12T13:00:00.000Z"),
      contest: { id: contest.id, accessCodeUpdatedAt: mutationTime },
    };
    expect(evaluateLockedContestStart(contest, { ...request, grant: oldGrant })).toMatchObject({ allowed: false, reason: "private-access" });
    expect(evaluateLockedContestStart(contest, { ...request, grant: { ...oldGrant, createdAt: mutationTime } })).toEqual({ allowed: true });
  });

  it("forbids resume when the locked state no longer permits start", () => {
    const decision = evaluateLockedContestStart({ ...openContest, status: "DRAFT" }, request);
    expect(decision).toMatchObject({ allowed: false, reason: "unavailable" });
  });
});

describe("production database-rate-limit factory with a mocked atomic store", () => {
  it("validates positive finite integer policies", () => {
    expect(validateRateLimitPolicy({ limit: 1, windowSeconds: 1 })).toBe(true);
    expect(validateRateLimitPolicy({ limit: 1.5, windowSeconds: 1 })).toBe(false);
    expect(validateRateLimitPolicy({ limit: 1, windowSeconds: 1.5 })).toBe(false);
    expect(validateRateLimitPolicy({ limit: Number.POSITIVE_INFINITY, windowSeconds: 1 })).toBe(false);
  });

  it("allows attempts 1 through limit and denies limit plus one", async () => {
    const store = new AtomicRateLimitStore();
    const check = createDbRateLimitChecker(store, { now: () => new Date("2026-07-12T00:00:00Z") });
    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(await check("contest-access", "contest-1:user-1", { limit: 5, windowSeconds: 60 }));
    }
    expect(results.slice(0, 5).every((result) => result.status === "allowed")).toBe(true);
    expect(results[5].status).toBe("rate-limited");
    expect(store.count("contest-access", "contest-1:user-1")).toBe(5);
  });

  it("counts two concurrent mocked requests after expiry", async () => {
    const store = new AtomicRateLimitStore();
    let now = new Date("2026-07-12T00:00:00Z");
    const check = createDbRateLimitChecker(store, { now: () => now });
    await check("action", "subject", { limit: 5, windowSeconds: 1 });
    now = new Date("2026-07-12T00:00:02Z");
    const results = await Promise.all([
      check("action", "subject", { limit: 5, windowSeconds: 1 }),
      check("action", "subject", { limit: 5, windowSeconds: 1 }),
    ]);
    expect(results.every((result) => result.status === "allowed")).toBe(true);
    expect(store.count("action", "subject")).toBe(2);
  });

  it("isolates actions and subjects", async () => {
    const store = new AtomicRateLimitStore();
    const check = createDbRateLimitChecker(store);
    await check("action-a", "subject-a", { limit: 1, windowSeconds: 60 });
    expect((await check("action-a", "subject-a", { limit: 1, windowSeconds: 60 })).status).toBe("rate-limited");
    expect((await check("action-b", "subject-a", { limit: 1, windowSeconds: 60 })).status).toBe("allowed");
    expect((await check("action-a", "subject-b", { limit: 1, windowSeconds: 60 })).status).toBe("allowed");
  });

  it("returns infrastructure-error without authorizing on store failure", async () => {
    const store: RateLimitAuthorizationStore = { authorize: async () => { throw new Error("offline"); } };
    const logger = { error: vi.fn() };
    const check = createDbRateLimitChecker(store, { logger });
    expect((await check("action", "subject", { limit: 1, windowSeconds: 60 })).status).toBe("infrastructure-error");
  });

  it("hashes account identifiers before storage", () => {
    const subject = hashRateLimitSubject("Learner@Example.com");
    expect(subject).toBe(hashRateLimitSubject("learner@example.com"));
    expect(subject).not.toContain("learner@example.com");
  });
});

describe("production Writing quota factory with a mocked atomic store", () => {
  it("uses an explicit UTC key immediately before midnight", () => {
    expect(getUtcQuotaKey(new Date("2026-07-12T23:59:59.999Z"))).toBe("2026-07-12");
  });

  it("changes the UTC key exactly at midnight", () => {
    expect(getUtcQuotaKey(new Date("2026-07-13T00:00:00.000Z"))).toBe("2026-07-13");
    expect(getUtcQuotaKey(new Date("2026-07-13T00:30:00.000+01:00"))).toBe("2026-07-12");
  });

  it("allows five concurrent mocked reservations and denies the sixth", async () => {
    const reserve = createWritingQuotaReserver(new AtomicWritingSlotStore(), {
      now: () => new Date("2026-07-12T12:00:00Z"),
    });
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve("user-1")));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed && result.reason === "quota-exceeded")).toHaveLength(1);
  });

  it("distinguishes infrastructure failure from quota exhaustion", async () => {
    const store: WritingSlotStore = {
      tryCreateSlot: async () => { throw new Error("offline"); },
    };
    const reserve = createWritingQuotaReserver(store, { logger: { error: vi.fn() } });
    expect(await reserve("user-1")).toMatchObject({ allowed: false, reason: "infrastructure-error" });
  });
});

describe("production replay guards with mocked repositories", () => {
  it("allows one contest-style conditional claim under simultaneous calls", async () => {
    let inProgress = true;
    const claim = async () => {
      if (!inProgress) return 0;
      inProgress = false;
      return 1;
    };
    const results = await Promise.allSettled([
      claimSingleWinner(claim, "Đã nộp."),
      claimSingleWinner(claim, "Đã nộp."),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("runs diagnostic-style side effects at most once", async () => {
    type Transaction = { id: number };
    let queue = Promise.resolve();
    let inProgress = true;
    let effects = 0;
    let transactionId = 0;
    const withTransaction = <T,>(operation: (transaction: Transaction) => Promise<T>): Promise<T> => {
      const run = queue.then(() => operation({ id: ++transactionId }));
      queue = run.then(() => undefined, () => undefined);
      return run;
    };
    const execute = () => runSingleWinnerTransaction(
      withTransaction,
      async () => {
        if (!inProgress) return 0;
        inProgress = false;
        return 1;
      },
      async () => { effects += 1; },
      "Đã hoàn thành.",
    );
    const results = await Promise.allSettled([execute(), execute()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(effects).toBe(1);
  });
});

describe("production submission input parsing", () => {
  it("does not pollute Object.prototype through diagnostic field names", () => {
    const answers = parseDiagnosticAnswerEntries([
      ["answer:__proto__:polluted", "yes"],
    ]);
    expect(Object.getPrototypeOf(answers)).toBeNull();
    expect(Object.getPrototypeOf(answers.__proto__ as object)).toBeNull();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it("ignores contest answers outside the stored question IDs", () => {
    const parsed = parseContestAnswerEntries(
      [
        ["answer:problem-1:question-1", "A"],
        ["answer:problem-1:unknown", "B"],
        ["answer:__proto__:polluted", "yes"],
      ],
      {
        problemQuestions: new Map([["problem-1", new Set(["question-1"])]]),
        sectionQuestions: new Map(),
      },
    );
    expect(parsed.answersByProblem).toEqual({ "problem-1": { "question-1": "A" } });
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });
});

describe("production missing-user password work", () => {
  it("always invokes the verifier with the fixed dummy hash for a missing user", () => {
    const verify = vi.fn(() => true);
    const verifyLogin = createLoginPasswordVerifier(verify);
    expect(verifyLogin("password", null)).toBe(false);
    expect(verify).toHaveBeenCalledExactlyOnceWith("password", DUMMY_PASSWORD_HASH_VALUE);
  });

  it("uses the real stored hash for an existing user", () => {
    const verify = vi.fn(() => false);
    const verifyLogin = createLoginPasswordVerifier(verify);
    expect(verifyLogin("password", "scrypt$salt$hash")).toBe(false);
    expect(verify).toHaveBeenCalledExactlyOnceWith("password", "scrypt$salt$hash");
  });

  it("uses a valid fixed precomputed scrypt dummy hash", () => {
    expect(verifyPassword("englishphile-dummy-password-v1", DUMMY_PASSWORD_HASH_VALUE)).toBe(true);
  });
});
