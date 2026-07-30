import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkQuestionAnswer } from "@/lib/answer-checking";

const validOptions = [
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
];

function score(
  studentAnswer: unknown,
  ...configuration: [unknown?, unknown?]
) {
  const options = configuration.length > 0 ? configuration[0] : validOptions;
  const answer = configuration.length > 1
    ? configuration[1]
    : { correctOptionId: "C" };
  const question = {
    type: "PRONUNCIATION_ODD_ONE_OUT",
    options,
    answer,
    explanation: "Giải thích nội bộ.",
  } as Parameters<typeof checkQuestionAnswer>[0];
  return checkQuestionAnswer(question, studentAnswer);
}

describe("Pronunciation server-side fail-closed scoring", () => {
  it("loads options only in the server-side diagnostic scoring projection", () => {
    const diagnostic = fs.readFileSync(
      path.join(process.cwd(), "src/lib/diagnostic.ts"),
      "utf8",
    );
    const scoringSelectStart = diagnostic.indexOf(
      "const diagnosticScoringQuestionSelect",
    );
    const scoringSelectEnd = diagnostic.indexOf(
      "} as const;",
      scoringSelectStart,
    );
    const scoringSelect = diagnostic.slice(
      scoringSelectStart,
      scoringSelectEnd,
    );

    expect(scoringSelect).toContain("answer: true");
    expect(scoringSelect).toContain("options: true");
    expect(scoringSelect).toContain("explanation: true");
  });

  it("scores only a canonical learner selection against a complete contract", () => {
    expect(score(" c ").isCorrect).toBe(true);
    expect(score("A").isCorrect).toBe(false);
    expect(score("C").correctAnswer).toBe("C");
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["blank", " "],
    ["non-member", "E"],
    ["numeric", 3],
    ["object", { id: "C" }],
  ])("never scores a %s learner selection true", (_name, learnerAnswer) => {
    expect(score(learnerAnswer).isCorrect).toBe(false);
  });

  it.each([
    ["missing options", undefined],
    ["null options", null],
    ["three options", validOptions.slice(0, 3)],
    ["missing span", validOptions.map(({ id, text }) => ({ id, text }))],
    ["invalid span", [
      { ...validOptions[0], targetSpan: { start: 2, end: 2 } },
      ...validOptions.slice(1),
    ]],
    ["malformed text", [{ ...validOptions[0], text: {} }, ...validOptions.slice(1)]],
  ])("never scores true with historical %s", (_name, options) => {
    expect(score("C", options).isCorrect).toBe(false);
  });

  it.each([
    ["missing answer", undefined],
    ["null answer", null],
    ["missing configured ID", {}],
    ["blank configured ID", { correctOptionId: " " }],
    ["non-member configured ID", { correctOptionId: "E" }],
    ["display-only alias", { display: "C" }],
    ["accepted-only alias", { accepted: ["C"] }],
  ])("never scores true with %s", (_name, answer) => {
    expect(score("C", validOptions, answer).isCorrect).toBe(false);
  });

  it("does not change ordinary MCQ scoring", () => {
    expect(checkQuestionAnswer({
      type: "MCQ",
      answer: { correctOptionId: "B" },
      explanation: null,
    }, " b ").isCorrect).toBe(true);
  });
});
