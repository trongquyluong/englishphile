import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { question: { findMany: mocks.findMany } },
}));

import {
  getLearnerWritingRubrics,
  projectWritingRubricRows,
} from "@/lib/dto/learner-writing-rubric.server";

describe("server-only learner Writing rubric source boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only IDs and raw answers for requested Writing rows, then returns safe data", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "writing-2",
        answer: {
          rubric: [" Task response ", "Coherence"],
          modelAnswer: "ANSWER_SENTINEL",
        },
      },
    ]);

    const result = await getLearnerWritingRubrics([
      "writing-2",
      "writing-1",
      "writing-2",
    ]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["writing-1", "writing-2"] },
        type: "WRITING_PROMPT",
      },
      select: {
        id: true,
        answer: true,
      },
    });
    expect(result.get("writing-2")).toEqual({
      criteria: ["Task response", "Coherence"],
    });
    expect(JSON.stringify([...result])).not.toContain("ANSWER_SENTINEL");
  });

  it("does not query for an empty authorized ID set", async () => {
    await expect(getLearnerWritingRubrics([])).resolves.toEqual(new Map());
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("drops malformed rows instead of returning partial or raw data", () => {
    const result = projectWritingRubricRows([
      { id: "valid", answer: { rubric: ["Task response"] } },
      { id: "malformed", answer: { rubric: ["Coherence", { secret: true }] } },
      { id: "missing", answer: { internal: "ADMIN_ONLY" } },
    ]);

    expect([...result]).toEqual([
      ["valid", { criteria: ["Task response"] }],
    ]);
    expect(JSON.stringify([...result])).not.toContain("ADMIN_ONLY");
    expect(JSON.stringify([...result])).not.toContain("secret");
  });
});
