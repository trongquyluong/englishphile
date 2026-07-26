import { describe, expect, it, vi } from "vitest";
import {
  CRON_SECRET_MAX_BYTES,
  CRON_SECRET_MIN_BYTES,
  createSecurityCleanupOrchestrator,
  isCronRequestAuthorized,
  type CleanupOperation,
  type SecurityCleanupDependencies,
} from "@/lib/security/cleanup-core";

const runSecurityCleanupMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/cleanup", () => ({ runSecurityCleanup: runSecurityCleanupMock }));

import * as cleanupRoute from "@/app/api/cron/security-cleanup/route";

describe("production cron bearer authentication", () => {
  const secret = "cron-secret-case-sensitive";

  it("accepts the exact Bearer credential", () => {
    expect(isCronRequestAuthorized(secret, `Bearer ${secret}`)).toBe(true);
  });

  it.each([
    [secret, "Bearer wrong-secret"],
    [secret, null],
    [secret, secret],
    [secret, `bearer ${secret}`],
    [secret, `Basic ${secret}`],
    [secret, "Bearer"],
    [secret, "Bearer "],
    [undefined, `Bearer ${secret}`],
    [null, `Bearer ${secret}`],
    ["", `Bearer ${secret}`],
  ])("fails closed for invalid configuration or authorization", (configured, header) => {
    expect(isCronRequestAuthorized(configured, header)).toBe(false);
  });

  it("handles unequal lengths without throwing", () => {
    const differentLength = "another-valid-length-secret";
    expect(() => isCronRequestAuthorized(secret, `Bearer ${differentLength}`)).not.toThrow();
    expect(isCronRequestAuthorized(secret, `Bearer ${differentLength}`)).toBe(false);
  });

  it("rejects configured secrets below the 16 UTF-8-byte minimum", () => {
    const tooShort = "x".repeat(CRON_SECRET_MIN_BYTES - 1);
    expect(isCronRequestAuthorized(tooShort, `Bearer ${tooShort}`)).toBe(false);
    expect(isCronRequestAuthorized("é".repeat(8), `Bearer ${"é".repeat(8)}`)).toBe(true);
  });

  it("rejects configured or presented credentials above the byte limit", () => {
    const oversized = "x".repeat(CRON_SECRET_MAX_BYTES + 1);
    expect(isCronRequestAuthorized(oversized, `Bearer ${oversized}`)).toBe(false);
    expect(() => isCronRequestAuthorized(secret, `Bearer ${oversized}`)).not.toThrow();
    expect(isCronRequestAuthorized(secret, `Bearer ${oversized}`)).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isCronRequestAuthorized(secret, `Bearer ${secret.toUpperCase()}`)).toBe(false);
  });

  it("does not silently normalize whitespace", () => {
    expect(isCronRequestAuthorized(secret, `Bearer ${secret} `)).toBe(false);
    expect(isCronRequestAuthorized(secret, `Bearer  ${secret}`)).toBe(false);
  });

  it("returns only a boolean and never the secret", () => {
    const result = isCronRequestAuthorized(secret, "Bearer wrong-secret");
    expect(result).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe("production cron route method behavior", () => {
  it("rejects HEAD without invoking cleanup", async () => {
    runSecurityCleanupMock.mockClear();
    const response = await cleanupRoute.HEAD();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(runSecurityCleanupMock).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const)(
    "rejects %s without invoking cleanup",
    async (method) => {
      runSecurityCleanupMock.mockClear();
      const response = await cleanupRoute[method]();

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("location")).toBeNull();
      expect(runSecurityCleanupMock).not.toHaveBeenCalled();
    },
  );
});

function successful(affected: number): CleanupOperation {
  return vi.fn(async () => ({ status: "success" as const, affected }));
}

function dependencies(overrides: Partial<SecurityCleanupDependencies> = {}): SecurityCleanupDependencies {
  return {
    rateLimits: successful(2),
    accessGrants: successful(3),
    writingReservations: successful(4),
    ...overrides,
  };
}

describe("production security cleanup orchestrator with injected operations", () => {
  it("invokes every component once, sequentially, and aggregates success", async () => {
    const order: string[] = [];
    const deps: SecurityCleanupDependencies = {
      rateLimits: vi.fn(async () => { order.push("rateLimits"); return { status: "success" as const, affected: 2 }; }),
      accessGrants: vi.fn(async () => { order.push("accessGrants"); return { status: "success" as const, affected: 3 }; }),
      writingReservations: vi.fn(async () => { order.push("writingReservations"); return { status: "success" as const, affected: 4 }; }),
    };
    let clock = 100;
    const run = createSecurityCleanupOrchestrator(deps, { now: () => clock++ });

    expect(await run()).toEqual({
      status: "success",
      counts: { rateLimits: 2, accessGrants: 3, writingReservations: 4 },
      totalAffected: 9,
      failedComponents: [],
      durationMs: 1,
    });
    expect(order).toEqual(["rateLimits", "accessGrants", "writingReservations"]);
    expect(deps.rateLimits).toHaveBeenCalledTimes(1);
    expect(deps.accessGrants).toHaveBeenCalledTimes(1);
    expect(deps.writingReservations).toHaveBeenCalledTimes(1);
  });

  it("treats successful zero-row cleanup as success", async () => {
    const run = createSecurityCleanupOrchestrator(dependencies({
      rateLimits: successful(0),
      accessGrants: successful(0),
      writingReservations: successful(0),
    }));
    expect(await run()).toMatchObject({ status: "success", totalAffected: 0, failedComponents: [] });
  });

  it("continues independent components after one reports infrastructure failure", async () => {
    const later = successful(7);
    const deps = dependencies({
      accessGrants: vi.fn(async () => ({ status: "infrastructure-error" as const })),
      writingReservations: later,
    });
    const result = await createSecurityCleanupOrchestrator(deps)();

    expect(result).toMatchObject({
      status: "failure",
      counts: { rateLimits: 2, accessGrants: 0, writingReservations: 7 },
      failedComponents: ["accessGrants"],
    });
    expect(later).toHaveBeenCalledTimes(1);
    expect(deps.accessGrants).toHaveBeenCalledTimes(1);
  });

  it("converts a raw thrown error to a safe aggregate failure without retry", async () => {
    const rawMessage = "database-host-and-row-details";
    const failing = vi.fn(async () => { throw new Error(rawMessage); });
    const result = await createSecurityCleanupOrchestrator(dependencies({ rateLimits: failing }))();

    expect(result.status).toBe("failure");
    expect(result.failedComponents).toEqual(["rateLimits"]);
    expect(JSON.stringify(result)).not.toContain(rawMessage);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid successful counts as component failure", async () => {
    const run = createSecurityCleanupOrchestrator(dependencies({
      accessGrants: vi.fn(async () => ({ status: "success" as const, affected: Number.POSITIVE_INFINITY })),
    }));
    expect(await run()).toMatchObject({ status: "failure", failedComponents: ["accessGrants"] });
  });

  it("has no retained run state across duplicate simulated invocations", async () => {
    const deps = dependencies();
    const run = createSecurityCleanupOrchestrator(deps);
    const [first, duplicate] = await Promise.all([run(), run()]);

    expect(first.status).toBe("success");
    expect(duplicate.status).toBe("success");
    expect(deps.rateLimits).toHaveBeenCalledTimes(2);
    expect(deps.accessGrants).toHaveBeenCalledTimes(2);
    expect(deps.writingReservations).toHaveBeenCalledTimes(2);
  });
});
