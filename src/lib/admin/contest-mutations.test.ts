import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: database.transaction } }));

import {
  createContestQuestion,
  deleteContestQuestion,
  deleteContestSection,
  publishContestAtomically,
  updateContestQuestion,
  updateContestSection,
} from "@/lib/admin/contest-mutations";
import { ADMIN_RESOURCE_UNAVAILABLE } from "@/lib/admin/mutation-locks";
import { ContentAdminTransactionAuthorizationError } from "@/lib/auth/content-admin-transaction";

function questionInput() {
  return {
    orderIndex: 0,
    type: "MCQ" as const,
    prompt: "Choose the answer.",
    optionsJson: [{ id: "A", text: "Answer" }],
    answerJson: { correctOptionId: "A" },
    points: 1,
  };
}

function transactionWith(overrides: Record<string, unknown> = {}) {
  let resourceRows: Array<{ id: string }> = [{ id: "contest-a" }];
  const tx = {
    $queryRaw: vi.fn().mockImplementation(async (query: unknown) => {
      const sql = Array.isArray(query)
        ? query.join("?")
        : Array.isArray((query as { strings?: unknown[] })?.strings)
          ? (query as { strings: unknown[] }).strings.join("?")
          : String(query);
      return sql.includes('FROM "User"')
        ? [{ id: "admin-a", email: "admin@example.test", role: "ADMIN" }]
        : resourceRows;
    }),
    contestSection: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue({ id: "section-a" }),
    },
    contestQuestion: {
      create: vi.fn().mockResolvedValue({ id: "question-a" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    contest: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "contest-a" }),
    },
    ...overrides,
  };
  Object.assign(tx, { setResourceRows: (rows: Array<{ id: string }>) => { resourceRows = rows; } });
  database.transaction.mockImplementation(async (callback) => callback(tx));
  return tx;
}

describe("contest admin parent binding (production helpers with mocked Prisma transaction)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a section only when the scoped update matches Contest A", async () => {
    const tx = transactionWith();
    const result = await updateContestSection("contest-a", "section-a", {
      title: "Section A",
      skillType: "READING",
      orderIndex: 0,
    }, "admin-a");
    expect(result.ok).toBe(true);
    expect(tx.contestSection.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "section-a", contestId: "contest-a" },
    }));
  });

  it("rejects a Contest B section without mutating it through Contest A", async () => {
    const tx = transactionWith();
    tx.contestSection.updateMany.mockResolvedValue({ count: 0 });
    tx.contestSection.deleteMany.mockResolvedValue({ count: 0 });
    const result = await updateContestSection("contest-a", "section-b", {
      title: "Foreign",
      skillType: "READING",
      orderIndex: 0,
    }, "admin-a");
    expect(result).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(await deleteContestSection("contest-a", "section-b", "admin-a")).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
  });

  it("scopes question update and delete through Question -> Section -> Contest", async () => {
    const tx = transactionWith();
    expect((await updateContestQuestion("contest-a", "question-a", questionInput(), "admin-a")).ok).toBe(true);
    expect(tx.contestQuestion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "question-a", section: { contestId: "contest-a" } },
    }));

    expect((await deleteContestQuestion("contest-a", "question-a", "admin-a")).ok).toBe(true);
    expect(tx.contestQuestion.deleteMany).toHaveBeenCalledWith({
      where: { id: "question-a", section: { contestId: "contest-a" } },
    });
  });

  it("performs no question mutation for a cross-parent ID and uses the same public result as missing", async () => {
    const crossTx = transactionWith();
    crossTx.contestQuestion.updateMany.mockResolvedValue({ count: 0 });
    crossTx.contestQuestion.deleteMany.mockResolvedValue({ count: 0 });
    const crossParent = await updateContestQuestion("contest-a", "question-b", questionInput(), "admin-a");
    const crossDelete = await deleteContestQuestion("contest-a", "question-b", "admin-a");

    const missingTx = transactionWith();
    (missingTx as typeof missingTx & { setResourceRows(rows: Array<{ id: string }>): void }).setResourceRows([]);
    const missing = await updateContestQuestion("contest-missing", "question-missing", questionInput(), "admin-a");

    expect(crossParent).toEqual(missing);
    expect(crossParent).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(crossDelete).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(missingTx.contestQuestion.updateMany).not.toHaveBeenCalled();
  });

  it("rejects question creation under a section from another contest", async () => {
    const tx = transactionWith();
    tx.contestSection.findFirst.mockResolvedValue(null);
    const result = await createContestQuestion("contest-a", "section-b", questionInput(), "admin-a");
    expect(result).toEqual({ ok: false, message: ADMIN_RESOURCE_UNAVAILABLE });
    expect(tx.contestQuestion.create).not.toHaveBeenCalled();
  });

  it("denies a downgraded principal before contest lookup or child mutation", async () => {
    const tx = transactionWith();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(updateContestSection("contest-a", "section-a", {
      title: "Section A",
      skillType: "READING",
      orderIndex: 0,
    }, "deleted-admin")).rejects.toBeInstanceOf(ContentAdminTransactionAuthorizationError);
    expect(tx.contestSection.updateMany).not.toHaveBeenCalled();
  });

  it("publishes a valid contest from the locked validation snapshot", async () => {
    const tx = transactionWith();
    tx.contest.findUnique.mockResolvedValue({
      id: "contest-a",
      title: "Contest",
      startsAt: null,
      sections: [{
        id: "section-a",
        title: "Section",
        skillType: "READING",
        audioUrl: null,
        questions: [{ id: "question-a", type: "MCQ", prompt: "Prompt", optionsJson: [{ id: "A" }], answerJson: { correctOptionId: "A" } }],
      }],
    });
    const result = await publishContestAtomically("contest-a", "admin-a", new Date("2026-01-01T00:00:00Z"));
    expect(result).toEqual({ ok: true, contestId: "contest-a", status: "LIVE" });
    expect(tx.contest.update).toHaveBeenCalledWith({ where: { id: "contest-a" }, data: { status: "LIVE" } });
  });

  it("does not represent an invalid locked snapshot as a successful publish", async () => {
    const tx = transactionWith();
    tx.contest.findUnique.mockResolvedValue({ id: "contest-a", title: "Contest", startsAt: null, sections: [] });
    const result = await publishContestAtomically("contest-a", "admin-a");
    expect(result.ok).toBe(false);
    expect(tx.contest.update).not.toHaveBeenCalled();
  });
});
