import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    writingSubmission: {
      findFirst: mocks.findFirst,
    },
  },
}));

import { toLearnerWritingGradeResult } from "@/lib/dto/writing-grade";
import { getLatestWritingReview } from "@/lib/writing-review";

const resultJson = {
  totalScore: 20,
  maxScore: 30,
  criteria: {
    content: { score: 6, maxScore: 9, comment: "Đúng trọng tâm." },
    organization: { score: 6, maxScore: 9, comment: "Bố cục rõ." },
    language: { score: 6, maxScore: 9, comment: "Ngôn ngữ phù hợp." },
    mechanics: { score: 2, maxScore: 3, comment: "Cần kiểm tra dấu câu." },
  },
  overallComment: "Cần phát triển thêm dẫn chứng.",
  strengths: ["Luận điểm rõ"],
  priorityIssues: ["Thêm dẫn chứng"],
  detailedFeedback: [
    {
      quote: "Machines can save time",
      issue: "Ý còn khái quát.",
      explanation: "Cần ví dụ cụ thể.",
      suggestedRevision: "Machines can save families time on repetitive chores.",
    },
  ],
  nextPracticeTasks: ["Viết một đoạn PEEL."],
  warnings: [],
  providerSecret: "PROVIDER-SENTINEL",
};

describe("learner Writing review boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      essayText: "Machines can save time for families. ".repeat(12),
      targetWordCount: "250-300",
      resultJson,
    });
  });

  it("loads only the latest review for the current user and selected prompt", async () => {
    const review = await getLatestWritingReview("current-user", "machines-at-home");

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "current-user",
        promptSlug: "machines-at-home",
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      select: {
        essayText: true,
        targetWordCount: true,
        resultJson: true,
      },
    });
    expect(review).toMatchObject({
      targetWordCount: "250-300",
      result: {
        totalScore: 20,
        overallComment: "Cần phát triển thêm dẫn chứng.",
      },
    });
    expect(JSON.stringify(review)).not.toContain("PROVIDER-SENTINEL");
  });

  it("fails closed for malformed stored feedback or unsupported target lengths", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      essayText: "Valid essay",
      targetWordCount: "250-300",
      resultJson: { ...resultJson, maxScore: 100 },
    });
    await expect(getLatestWritingReview("current-user", "machines-at-home")).resolves.toBeNull();

    mocks.findFirst.mockResolvedValueOnce({
      essayText: "Valid essay",
      targetWordCount: "unbounded",
      resultJson,
    });
    await expect(getLatestWritingReview("current-user", "machines-at-home")).resolves.toBeNull();
  });

  it("positive-maps nested result fields and rejects oversized retained content", () => {
    const mapped = toLearnerWritingGradeResult(resultJson);
    expect(mapped).not.toBeNull();
    expect(mapped).not.toHaveProperty("providerSecret");

    expect(
      toLearnerWritingGradeResult({
        ...resultJson,
        overallComment: "x".repeat(4_001),
      }),
    ).toBeNull();
  });
});
