import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentAdminTransactionAuthorizationError,
  requireContentAdminInTransaction,
} from "@/lib/auth/content-admin-transaction";

function txWith(user: { id: string; email: string; role: "STUDENT" | "ADMIN" } | null) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(user ? [user] : []),
  };
}

describe("transaction-bound content-admin revalidation (production helper with mocked Prisma transaction)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a current stored ADMIN and uses a FOR UPDATE user lock", async () => {
    const tx = txWith({ id: "admin-a", email: "admin@example.test", role: "ADMIN" });
    await expect(requireContentAdminInTransaction(tx as never, "admin-a")).resolves.toEqual({ id: "admin-a" });
    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toContain('FROM "User"');
    expect(sql).toContain("FOR UPDATE");
  });

  it("accepts a current OWNER_EMAIL-matching STUDENT with normalized matching", async () => {
    vi.stubEnv("OWNER_EMAIL", "  Owner@Example.Test  ");
    const tx = txWith({ id: "owner-a", email: "owner@example.test", role: "STUDENT" });
    await expect(requireContentAdminInTransaction(tx as never, "owner-a")).resolves.toEqual({ id: "owner-a" });
  });

  it.each([
    ["missing/deleted user", null],
    ["downgraded ordinary STUDENT", { id: "admin-a", email: "student@example.test", role: "STUDENT" as const }],
  ])("denies a %s before callers can look up resources", async (_label, user) => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.test");
    const tx = txWith(user);
    await expect(requireContentAdminInTransaction(tx as never, "admin-a"))
      .rejects.toBeInstanceOf(ContentAdminTransactionAuthorizationError);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
