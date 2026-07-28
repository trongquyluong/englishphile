import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  resolveRemainingAttempts,
  WritingGraderForm,
} from "@/components/writing/WritingGraderForm";

describe("Writing grader immediate quota transition", () => {
  it("uses the successful API remaining count immediately", () => {
    expect(resolveRemainingAttempts(1, 2, 2)).toBe(1);
    expect(resolveRemainingAttempts(0, 1, 2)).toBe(0);
  });

  it("keeps the current display for malformed or out-of-range responses", () => {
    expect(resolveRemainingAttempts("1", 2, 2)).toBe(2);
    expect(resolveRemainingAttempts(3, 2, 2)).toBe(2);
    expect(resolveRemainingAttempts(-1, 2, 2)).toBe(2);
  });

  it("renders the persisted essay, feedback, and current quota after a refresh", () => {
    const essayText = "PERSISTED-ESSAY-SENTINEL";
    const html = renderToStaticMarkup(
      createElement(WritingGraderForm, {
        enabled: true,
        isAuthenticated: true,
        prompt: {
          slug: "machines-at-home",
          title: "Machines at home",
          statement: "Do machines bring more advantages or disadvantages?",
          essayType: "Advantage–Disadvantage essay",
          targetWordCount: "250–300 từ",
          difficulty: "Chuyên",
        },
        quota: { remaining: 1, total: 2 },
        initialReview: {
          essayText,
          targetWordCount: "250-300",
          result: {
            totalScore: 20,
            maxScore: 30,
            criteria: {
              content: { score: 6, maxScore: 9, comment: "Đúng trọng tâm." },
              organization: { score: 6, maxScore: 9, comment: "Bố cục rõ." },
              language: { score: 6, maxScore: 9, comment: "Ngôn ngữ phù hợp." },
              mechanics: { score: 2, maxScore: 3, comment: "Cần kiểm tra dấu câu." },
            },
            overallComment: "PERSISTED-FEEDBACK-SENTINEL",
            strengths: [],
            priorityIssues: [],
            detailedFeedback: [],
            nextPracticeTasks: [],
            warnings: [],
          },
        },
      }),
    );

    expect(html).toContain("Còn");
    expect(html).toContain("1</span>/2 lượt chấm AI hôm nay");
    expect(html).toContain(essayText);
    expect(html).toContain("PERSISTED-FEEDBACK-SENTINEL");
    expect(html).toContain("kết quả chấm gần nhất");
    expect(html).toContain('id="writing-grade-result"');
  });
});
