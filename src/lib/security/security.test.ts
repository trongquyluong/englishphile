import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static structural checks only. These tests complement, but do not count as,
 * production-runtime security tests. See helpers.test.ts for imported helpers
 * and factories exercised with mocked repositories.
 */

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("static database limiter structure", () => {
  it("uses one parameterized INSERT ON CONFLICT authorization operation", () => {
    const implementation = source("src/lib/security/rate-limit.ts");
    expect(implementation.match(/INSERT INTO "RateLimitBucket"/g)).toHaveLength(1);
    expect(implementation).toContain("ON CONFLICT (\"action\", \"subject\") DO UPDATE");
    expect(implementation).toContain('OR "RateLimitBucket"."count" < ${limit}');
    expect(implementation).toContain('RETURNING "count", "expiresAt"');
    expect(implementation).not.toContain("rateLimitBucket.findUnique");
    expect(implementation).not.toContain("allowDbFailure");
  });

  it("reasserts the expiry predicate during bounded cleanup", () => {
    const implementation = source("src/lib/security/rate-limit.ts");
    expect(implementation).toContain("LIMIT ${RATE_LIMIT_CLEANUP_BATCH}");
    expect(implementation.match(/AND "expiresAt" < \$\{cutoff\}/g)).toHaveLength(1);
  });
});

describe("static distributed caller coverage", () => {
  const protectedCallers = [
    "src/app/auth/actions.ts",
    "src/app/contests/actions.ts",
    "src/app/diagnostic/actions.ts",
    "src/app/api/writing/grade/route.ts",
    "src/app/api/submissions/route.ts",
    "src/app/api/practice/random/route.ts",
    "src/app/api/assignments/[id]/submit/route.ts",
    "src/app/api/admin/contests-import/parse/route.ts",
    "src/app/api/admin/import/validate/route.ts",
    "src/app/api/admin/import/commit/route.ts",
    "src/app/api/admin/import/files/validate/route.ts",
    "src/app/api/admin/import/files/commit/route.ts",
  ];

  it.each(protectedCallers)("uses the database limiter in %s", (file) => {
    const implementation = source(file);
    expect(implementation).toContain("checkConfiguredRateLimit");
    expect(implementation).not.toContain('from "@/lib/rate-limit"');
  });
});

describe("static Writing lifecycle and cleanup", () => {
  it("stores FAILED plus failureCode after provider start", () => {
    const implementation = source("src/lib/security/writing-quota.ts");
    expect(implementation).toContain('status: "FAILED"');
    expect(implementation).toContain("failureCode,");
    expect(implementation).toContain("providerStartedAt: { not: null }");
  });

  it("uses mapped database columns and reasserts reclaim predicates", () => {
    const implementation = source("src/lib/security/writing-quota.ts");
    expect(implementation).toContain('AND "provider_started_at" IS NULL');
    expect(implementation).toContain('AND "expires_at" < ${now}');
    expect(implementation).not.toContain('"providerStartedAt" IS NULL');
  });

  it("casts the explicit UTC quota key to date in every SQL comparison", () => {
    const implementation = source("src/lib/security/writing-quota.ts");
    expect(implementation).toContain("VALUES (${userId}, ${quotaKey}::date");
    expect(implementation.match(/\$\{quotaKey\}::date/g)?.length).toBeGreaterThanOrEqual(6);
    expect(implementation).not.toContain("${quotaDate}");
  });
});

describe("static contest grant invalidation coverage", () => {
  it.each([
    "src/lib/contests.ts",
    "src/app/admin/contests-builder/actions.ts",
    "scripts/db-import-portable.ts",
  ])("updates the boundary and deletes grants transactionally in %s", (file) => {
    const implementation = source(file);
    expect(implementation).toContain("accessCodeUpdatedAt: new Date()");
    expect(implementation).toContain("contestAccessGrant.deleteMany");
    expect(implementation).toContain("$transaction");
  });

  it("locks the contest while verifying and creating a grant", () => {
    const implementation = source("src/lib/security/access-grant.ts");
    expect(implementation).toContain("FOR UPDATE");
    expect(implementation).toContain("verifyAccessCode(providedCode, contest.accessCode)");
  });
});

describe("static replay predicates", () => {
  it.each(["src/lib/contests.ts", "src/lib/diagnostic.ts"])(
    "serializes concurrent in-progress attempt creation in %s",
    (file) => {
      expect(source(file)).toContain("pg_advisory_xact_lock");
    },
  );

  it("scopes contest finalization to attempt, contest, user, and IN_PROGRESS", () => {
    const implementation = source("src/lib/contests.ts");
    expect(implementation).toContain("id: attemptId");
    expect(implementation).toContain("contestId: contest.id");
    expect(implementation).toContain("userId,");
    expect(implementation).toContain('status: "IN_PROGRESS"');
    expect(implementation).toContain("claimSingleWinner");
  });

  it("revalidates locked availability and content before resuming an attempt", () => {
    const implementation = source("src/lib/contests.ts");
    expect(implementation).toContain('SELECT "id", "contestType", "status", "startsAt", "endsAt", "visibility", "accessCodeUpdatedAt"');
    const decisionIndex = implementation.indexOf("evaluateLockedContestStart(lockedContest");
    const existingIndex = implementation.indexOf("tx.contestAttempt.findFirst", decisionIndex);
    expect(decisionIndex).toBeGreaterThan(-1);
    expect(existingIndex).toBeGreaterThan(decisionIndex);
    expect(implementation).toContain('FROM "ContestProblem"');
    expect(implementation).toContain('FROM "ContestSection"');
    expect(implementation.match(/FOR SHARE/g)).toHaveLength(2);
  });

  it("claims diagnostic finalization before transactional side effects", () => {
    const implementation = source("src/lib/diagnostic.ts");
    expect(implementation).toContain("runSingleWinnerTransaction");
    expect(implementation).toContain("id: attemptId");
    expect(implementation).toContain('status: "IN_PROGRESS"');
  });
});

describe("static schema and migration integrity", () => {
  it("contains required constraints, enums, foreign keys, and cascade behavior", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260711152247_add_security_rate_limits/migration.sql");
    expect(schema).toContain("enum WritingQuotaReservationStatus");
    expect(schema).toContain('dbgenerated("gen_random_uuid()::text")');
    expect(migration).toContain('CONSTRAINT "RateLimitBucket_count_check" CHECK ("count" >= 1)');
    expect(migration).toContain('CHECK ("slot_number" >= 1 AND "slot_number" <= 5)');
    expect(migration.match(/ON DELETE CASCADE/g)).toHaveLength(3);
    expect(migration.match(/ON UPDATE CASCADE/g)).toHaveLength(3);
  });
});

describe("static unsafe Route Handler origin coverage", () => {
  const routes = [
    "src/app/api/submissions/route.ts",
    "src/app/api/practice/random/route.ts",
    "src/app/api/assignments/[id]/submit/route.ts",
    "src/app/api/writing/grade/route.ts",
    "src/app/api/admin/contests-import/parse/route.ts",
    "src/app/api/admin/import/files/commit/route.ts",
    "src/app/api/admin/import/validate/route.ts",
    "src/app/api/admin/import/commit/route.ts",
    "src/app/api/admin/import/files/validate/route.ts",
  ];

  it.each(routes)("validates origin in %s", (file) => {
    expect(source(file)).toContain("validateRequestOrigin");
  });
});
