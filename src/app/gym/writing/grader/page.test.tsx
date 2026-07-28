import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isWritingGraderEnabled: vi.fn(),
  getWritingPromptBySlug: vi.fn(),
  getWritingQuotaStatus: vi.fn(),
  getLatestWritingReview: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/ai/writing-grader", () => ({
  isWritingGraderEnabled: mocks.isWritingGraderEnabled,
}));
vi.mock("@/lib/writing-prompts", () => ({
  getWritingPromptBySlug: mocks.getWritingPromptBySlug,
}));
vi.mock("@/lib/security/writing-quota", () => ({
  getWritingQuotaStatus: mocks.getWritingQuotaStatus,
}));
vi.mock("@/lib/writing-review", () => ({
  getLatestWritingReview: mocks.getLatestWritingReview,
}));

import WritingGraderPage from "@/app/gym/writing/grader/page";
import { WritingGraderForm } from "@/components/writing/WritingGraderForm";

function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) {
    return null;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element;
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, type);
}

const prompt = {
  slug: "machines-at-home",
  title: "Machines at home",
  statement: "Do machines bring more advantages or disadvantages?",
  essayType: "Advantage–Disadvantage essay",
  targetWordCount: "250–300 từ",
  difficulty: "Chuyên",
};

const initialReview = {
  essayText: "Machines can save time for families.",
  targetWordCount: "250-300",
  result: {
    totalScore: 20,
    maxScore: 30,
    criteria: {
      content: { score: 6, maxScore: 9, comment: "Ổn." },
      organization: { score: 6, maxScore: 9, comment: "Ổn." },
      language: { score: 6, maxScore: 9, comment: "Ổn." },
      mechanics: { score: 2, maxScore: 3, comment: "Ổn." },
    },
    overallComment: "Cần thêm dẫn chứng.",
    strengths: [],
    priorityIssues: [],
    detailedFeedback: [],
    nextPracticeTasks: [],
    warnings: [],
  },
};

describe("Writing grader review page boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "current-user", role: "STUDENT" });
    mocks.isWritingGraderEnabled.mockReturnValue(true);
    mocks.getWritingPromptBySlug.mockReturnValue(prompt);
    mocks.getWritingQuotaStatus.mockResolvedValue({ used: 1, remaining: 1, total: 2 });
    mocks.getLatestWritingReview.mockResolvedValue(initialReview);
  });

  it("loads the current learner's latest prompt review and hydrates the client form", async () => {
    const page = await WritingGraderPage({
      searchParams: Promise.resolve({ prompt: "machines-at-home" }),
    });

    expect(mocks.getLatestWritingReview).toHaveBeenCalledWith(
      "current-user",
      "machines-at-home",
    );
    const form = findElement(page, WritingGraderForm);
    expect(form?.props).toMatchObject({
      enabled: true,
      isAuthenticated: true,
      prompt,
      quota: { used: 1, remaining: 1, total: 2 },
      initialReview,
    });
  });

  it("does not query learner history when no user is authenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const page = await WritingGraderPage({
      searchParams: Promise.resolve({ prompt: "machines-at-home" }),
    });

    expect(mocks.getLatestWritingReview).not.toHaveBeenCalled();
    expect(mocks.getWritingQuotaStatus).not.toHaveBeenCalled();
    const form = findElement(page, WritingGraderForm);
    expect(form?.props).toMatchObject({
      isAuthenticated: false,
      quota: null,
      initialReview: null,
    });
  });
});
