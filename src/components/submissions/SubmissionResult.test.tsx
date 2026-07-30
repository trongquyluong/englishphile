import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmissionResult } from "@/components/submissions/SubmissionResult";

describe("Writing submission result presentation", () => {
  it("shows a neutral review state instead of correct or incorrect labels", () => {
    const html = renderToStaticMarkup(
      <SubmissionResult
        result={{
          submissionId: "submission-1",
          status: "NEEDS_REVIEW",
          score: 0,
          total: 0,
          answers: [{
            questionId: "writing-1",
            isCorrect: null,
            feedback: "Đã ghi nhận câu trả lời. Nội dung này đang chờ xem xét.",
          }],
        }}
      />,
    );

    expect(html).toContain("Đã ghi nhận câu trả lời");
    expect(html).toContain("đang chờ xem xét");
    expect(html).not.toContain("Chính xác.");
    expect(html).not.toContain("Chưa chính xác.");
  });
});
