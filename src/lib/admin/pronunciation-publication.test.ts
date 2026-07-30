import { describe, expect, it } from "vitest";
import {
  questionPublishErrors,
  validateQuestionEditPayload,
  type QuestionEditPayload,
} from "@/lib/admin/questions";

const validOptions = [
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
];

function payload(
  options: unknown,
  answer: unknown = { correctOptionId: "C" },
): QuestionEditPayload {
  return {
    id: "pronunciation-question",
    type: "PRONUNCIATION_ODD_ONE_OUT",
    skillType: "PRONUNCIATION",
    difficulty: "C1",
    prompt: "Chọn một từ.",
    options,
    answer,
    metadata: { focus: "not-authoritative" },
    orderIndex: 0,
    contentStatus: "PUBLISHED",
  };
}

describe("Pronunciation minimal publication validation", () => {
  it("accepts only the complete canonical contract", () => {
    expect(questionPublishErrors(payload(validOptions))).toEqual([]);
    expect(validateQuestionEditPayload(payload(validOptions))).toEqual({
      ok: true,
      message: "OK",
    });
  });

  it.each([
    ["missing spans", validOptions.map(({ id, text }) => ({ id, text })), { correctOptionId: "C" }],
    ["malformed options", validOptions.slice(0, 3), { correctOptionId: "C" }],
    ["malformed text", [{ ...validOptions[0], text: {} }, ...validOptions.slice(1)], { correctOptionId: "C" }],
    ["invalid range", [{ ...validOptions[0], targetSpan: { start: 3, end: 3 } }, ...validOptions.slice(1)], { correctOptionId: "C" }],
    ["missing answer", validOptions, null],
    ["blank answer", validOptions, { correctOptionId: " " }],
    ["non-member answer", validOptions, { correctOptionId: "E" }],
  ])("blocks %s before edit persistence", (_name, options, answer) => {
    expect(questionPublishErrors(payload(options, answer)).length)
      .toBeGreaterThan(0);
    expect(validateQuestionEditPayload(payload(options, answer)).ok).toBe(false);
  });
});
