import { describe, expect, it } from "vitest";
import {
  isShortNonBlankExplanation,
  reviewAnswerPositionDistribution,
  SHORT_EXPLANATION_THRESHOLD,
} from "@/lib/content-quality-heuristics";

const options = [
  { id: "A", text: "One" },
  { id: "B", text: "Two" },
  { id: "C", text: "Three" },
  { id: "D", text: "Four" },
];

function optionQuestion(
  position: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    type: "MCQ",
    options,
    answer: { correctOptionId: position },
    ...overrides,
  };
}

describe("explanation-depth heuristic", () => {
  it.each([
    ["missing", undefined, false],
    ["non-string", 44, false],
    ["blank", "   ", false],
    ["one code unit", "x", true],
    ["44 code units", "x".repeat(44), true],
    ["45 code units", "x".repeat(SHORT_EXPLANATION_THRESHOLD), false],
    ["more than 45 code units", "x".repeat(46), false],
    ["trimmed 44 code units", `  ${"x".repeat(44)}  `, true],
    ["trimmed 45 code units", `  ${"x".repeat(45)}  `, false],
  ])("classifies %s deterministically", (_label, value, expected) => {
    expect(isShortNonBlankExplanation(value)).toBe(expected);
  });

  it("measures UTF-16 code units and does not mutate the caller-owned value", () => {
    const value = `  ${"😀".repeat(22)}  `;
    const original = value;

    expect(value.trim()).toHaveLength(44);
    expect(isShortNonBlankExplanation(value)).toBe(true);
    expect(value).toBe(original);
  });
});

describe("answer-position distribution heuristic", () => {
  it.each([
    ["A,A,A,B", ["A", "A", "A", "B"], true],
    ["A,A,B,B", ["A", "A", "B", "B"], false],
    ["A,B,C,D", ["A", "B", "C", "D"], false],
    ["A,A,A", ["A", "A", "A"], false],
    ["eight questions with D absent", ["A", "A", "B", "B", "B", "C", "C", "C"], true],
  ])("evaluates %s", (_label, positions, expected) => {
    const review = reviewAnswerPositionDistribution(
      positions.map((position) => optionQuestion(position)),
    );

    expect(review.isSkewed).toBe(expected);
  });

  it("excludes invalid, duplicated, non-member, and unsupported values", () => {
    const review = reviewAnswerPositionDistribution([
      optionQuestion("A"),
      optionQuestion("A"),
      optionQuestion("A"),
      optionQuestion("A", { options: options.slice(0, 3) }),
      optionQuestion("A", {
        options: [options[0], { ...options[1], id: "A" }, options[2], options[3]],
      }),
      optionQuestion("Z"),
      optionQuestion("A", { type: "ERROR_IDENTIFICATION" }),
    ]);

    expect(review).toEqual({
      eligibleQuestions: 3,
      counts: { A: 3, B: 0, C: 0, D: 0 },
      isSkewed: false,
    });
  });

  it("supports the audit-compatible option and answer aliases", () => {
    const review = reviewAnswerPositionDistribution([
      optionQuestion("unused", {
        type: "PRONUNCIATION_ODD_ONE_OUT",
        options: options.map(({ id, text }) => ({ label: id.toLowerCase(), text })),
        answer: { correctOption: " d " },
      }),
    ]);

    expect(review.counts).toEqual({ A: 0, B: 0, C: 0, D: 1 });
  });

  it.each([
    ["blank", { id: "A", text: "" }],
    ["whitespace-only", { id: "A", text: " \t " }],
    ["missing", { id: "A" }],
    ["non-string", { id: "A", text: 1 }],
  ])("excludes %s option text", (_label, invalidOption) => {
    const review = reviewAnswerPositionDistribution([
      optionQuestion("A", { options: [invalidOption, ...options.slice(1)] }),
      ...["A", "A", "A"].map((position) => optionQuestion(position)),
    ]);

    expect(review).toEqual({
      eligibleQuestions: 3,
      counts: { A: 3, B: 0, C: 0, D: 0 },
      isSkewed: false,
    });
  });

  it("excludes inherited option text", () => {
    const inheritedTextOption = Object.create({ text: "One" }) as Record<
      string,
      unknown
    >;
    inheritedTextOption.id = "A";

    const review = reviewAnswerPositionDistribution([
      optionQuestion("A", {
        options: [inheritedTextOption, ...options.slice(1)],
      }),
      ...["A", "A", "A"].map((position) => optionQuestion(position)),
    ]);

    expect(review.eligibleQuestions).toBe(3);
    expect(review.isSkewed).toBe(false);
  });

  it("rejects getter-backed identifiers and text without invoking or changing them", () => {
    let accessorCalls = 0;
    const accessorIdOption = Object.defineProperty(
      { text: "One" },
      "id",
      {
        enumerable: true,
        get: () => {
          accessorCalls += 1;
          throw new Error("id getter must not run");
        },
      },
    );
    const accessorTextOption = Object.defineProperty(
      { id: "A" },
      "text",
      {
        enumerable: true,
        get: () => {
          accessorCalls += 1;
          throw new Error("text getter must not run");
        },
      },
    );
    const idDescriptor = Object.getOwnPropertyDescriptor(accessorIdOption, "id");
    const textDescriptor = Object.getOwnPropertyDescriptor(
      accessorTextOption,
      "text",
    );

    const review = reviewAnswerPositionDistribution([
      optionQuestion("A", {
        options: [accessorIdOption, ...options.slice(1)],
      }),
      optionQuestion("A", {
        options: [accessorTextOption, ...options.slice(1)],
      }),
      ...["A", "A", "A"].map((position) => optionQuestion(position)),
    ]);

    expect(accessorCalls).toBe(0);
    expect(review).toEqual({
      eligibleQuestions: 3,
      counts: { A: 3, B: 0, C: 0, D: 0 },
      isSkewed: false,
    });
    expect(Object.getOwnPropertyDescriptor(accessorIdOption, "id")).toEqual(
      idDescriptor,
    );
    expect(Object.getOwnPropertyDescriptor(accessorTextOption, "text")).toEqual(
      textDescriptor,
    );
  });

  it("continues to accept ordinary own A-D option data", () => {
    const review = reviewAnswerPositionDistribution([optionQuestion("D")]);

    expect(review).toEqual({
      eligibleQuestions: 1,
      counts: { A: 0, B: 0, C: 0, D: 1 },
      isSkewed: false,
    });
  });

  it("returns a fresh ordered count object without mutating questions", () => {
    const questions = ["A", "B", "C", "D"].map((position) =>
      optionQuestion(position),
    );
    const before = JSON.stringify(questions);
    const review = reviewAnswerPositionDistribution(questions);

    expect(Object.keys(review.counts)).toEqual(["A", "B", "C", "D"]);
    expect(JSON.stringify(questions)).toBe(before);
  });
});
