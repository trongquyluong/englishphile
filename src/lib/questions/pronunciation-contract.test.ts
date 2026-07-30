import { describe, expect, it } from "vitest";
import {
  normalizePronunciationAnswer,
  normalizePronunciationOptions,
  PRONUNCIATION_OPTION_IDS,
  PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS,
  slicePronunciationText,
  validatePronunciationContract,
  validatePronunciationOptions,
} from "@/lib/questions/pronunciation-contract";

function option(id: unknown, text: unknown, start = 0, end = 1) {
  return { id, text, targetSpan: { start, end } };
}

function validOptions(): Array<Record<string, unknown>> {
  return [
    option("A", "seat", 1, 3),
    option("B", "leaf", 1, 3),
    option("C", "bread", 2, 4),
    option("D", "team", 1, 3),
  ];
}

function codes(options: unknown, ...answerValues: [unknown?]) {
  const answer = answerValues.length > 0
    ? answerValues[0]
    : { correctOptionId: "A" };
  return validatePronunciationContract(options, answer).issues.map(
    (issue) => issue.code,
  );
}

describe("Pronunciation target-span contract", () => {
  it("returns a deterministic safe A-D projection from arbitrary source order", () => {
    const source = [validOptions()[3], validOptions()[1], validOptions()[0], validOptions()[2]];
    const result = validatePronunciationContract(source, {
      correctOptionId: " a ",
      accepted: ["D"],
      display: "D",
    });

    expect(result.valid).toBe(true);
    expect(result.options.map((item) => item.id)).toEqual(
      PRONUNCIATION_OPTION_IDS,
    );
    expect(result.correctOptionId).toBe("A");
    expect(result.options).toEqual([
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ]);
  });

  it("normalizes supported label/id and correctOption aliases without losing spans", () => {
    const rawOptions = validOptions().map(({ id, ...rest }) => ({
      label: ` ${String(id).toLowerCase()} `,
      ...rest,
    }));
    const normalizedOptions = normalizePronunciationOptions(rawOptions);
    const normalizedAnswer = normalizePronunciationAnswer({
      correctOption: " c ",
      display: "not-authoritative",
    });

    expect(validatePronunciationContract(
      normalizedOptions,
      normalizedAnswer,
    ).valid).toBe(true);
    expect(normalizedOptions).toEqual(
      validOptions().map((item) => ({ label: ` ${String(item.id).toLowerCase()} `, text: item.text, targetSpan: item.targetSpan, id: item.id })),
    );
    expect(normalizedAnswer).toEqual({
      correctOption: " c ",
      correctOptionId: "C",
      display: "not-authoritative",
    });
  });

  it.each([
    ["missing", undefined, "OPTIONS_REQUIRED"],
    ["null", null, "OPTIONS_REQUIRED"],
    ["object", {}, "OPTIONS_REQUIRED"],
    ["three", validOptions().slice(0, 3), "OPTION_COUNT_NOT_FOUR"],
    ["five", [...validOptions(), option("A", "extra")], "OPTION_COUNT_NOT_FOUR"],
  ])("rejects %s options", (_name, options, expectedCode) => {
    expect(codes(options)).toContain(expectedCode);
    expect(validatePronunciationOptions(options).options).toEqual([]);
  });

  it("accepts lowercase and whitespace IDs after deliberate canonicalization", () => {
    const options = validOptions().map((item) => ({
      ...item,
      id: ` ${String(item.id).toLowerCase()} `,
    }));
    const result = validatePronunciationContract(options, {
      correctOptionId: " d ",
    });
    expect(result.valid).toBe(true);
    expect(result.options.map((item) => item.id)).toEqual(["A", "B", "C", "D"]);
    expect(result.correctOptionId).toBe("D");
  });

  it.each([
    ["numeric", 1],
    ["object", { value: "A" }],
    ["malformed", "E"],
    ["blank", "  "],
  ])("rejects %s IDs without stringifying them", (_name, badId) => {
    const options = validOptions();
    options[0] = option(badId, "seat", 1, 3);
    expect(codes(options)).toContain("INVALID_OPTION_ID");
  });

  it("rejects duplicate, missing, and extra canonical IDs", () => {
    const options = validOptions();
    options[3] = option(" a ", "team", 1, 3);
    const resultCodes = codes(options);
    expect(resultCodes).toContain("DUPLICATE_OPTION_ID");
    expect(resultCodes).toContain("MISSING_CANONICAL_OPTION_ID");
  });

  it.each([
    ["blank", " "],
    ["numeric", 7],
    ["object", { word: "seat" }],
    ["array", ["seat"]],
    ["boolean", true],
    ["null", null],
  ])("rejects %s option text without stringification", (_name, text) => {
    const options = validOptions();
    options[0] = option("A", text, 0, 1);
    expect(codes(options)).toContain("INVALID_OPTION_TEXT");
  });

  it("bounds display text by Unicode code points", () => {
    const options = validOptions();
    options[0] = option(
      "A",
      "a".repeat(PRONUNCIATION_OPTION_TEXT_MAX_CODE_POINTS + 1),
      0,
      1,
    );
    expect(codes(options)).toContain("OPTION_TEXT_TOO_LONG");
  });

  it.each([
    ["missing", undefined, "TARGET_SPAN_REQUIRED"],
    ["null", null, "TARGET_SPAN_REQUIRED"],
    ["string", "0-1", "TARGET_SPAN_INVALID_OBJECT"],
    ["array", [0, 1], "TARGET_SPAN_INVALID_OBJECT"],
    ["missing start", { end: 1 }, "TARGET_SPAN_START_REQUIRED"],
    ["missing end", { start: 0 }, "TARGET_SPAN_END_REQUIRED"],
    ["string start", { start: "0", end: 1 }, "TARGET_SPAN_START_INVALID"],
    ["string end", { start: 0, end: "1" }, "TARGET_SPAN_END_INVALID"],
    ["float", { start: 0.5, end: 1 }, "TARGET_SPAN_START_INVALID"],
    ["NaN", { start: Number.NaN, end: 1 }, "TARGET_SPAN_START_INVALID"],
    ["Infinity", { start: 0, end: Number.POSITIVE_INFINITY }, "TARGET_SPAN_END_INVALID"],
    ["negative", { start: -1, end: 1 }, "TARGET_SPAN_RANGE_INVALID"],
    ["reversed", { start: 2, end: 1 }, "TARGET_SPAN_RANGE_INVALID"],
    ["equal", { start: 1, end: 1 }, "TARGET_SPAN_RANGE_INVALID"],
    ["out of range", { start: 0, end: 5 }, "TARGET_SPAN_RANGE_INVALID"],
  ])("rejects a %s target span", (_name, targetSpan, expectedCode) => {
    const options = validOptions();
    options[0] = { id: "A", text: "seat", targetSpan };
    expect(codes(options)).toContain(expectedCode);
  });

  it.each([
    ["whitespace", "a b", { start: 1, end: 2 }],
    ["punctuation", "a-b", { start: 1, end: 2 }],
    ["combining mark only", "a\u0301", { start: 1, end: 2 }],
  ])("rejects a %s-only target", (_name, text, targetSpan) => {
    const options = validOptions();
    options[0] = { id: "A", text, targetSpan };
    expect(codes(options)).toContain("TARGET_SPAN_WITHOUT_LETTER");
  });

  it("slices ASCII and preserves the complete visible text", () => {
    const parts = slicePronunciationText("bread", { start: 2, end: 4 });
    expect(parts).toEqual({ prefix: "br", target: "ea", suffix: "d" });
    expect(parts.prefix + parts.target + parts.suffix).toBe("bread");
  });

  it("uses Unicode code points rather than UTF-16 code units", () => {
    const parts = slicePronunciationText("😀éx", { start: 1, end: 2 });
    expect(parts).toEqual({ prefix: "😀", target: "é", suffix: "x" });
    const options = validOptions();
    options[0] = { id: "A", text: "😀éx", targetSpan: { start: 1, end: 2 } };
    expect(validatePronunciationOptions(options).valid).toBe(true);
  });

  it("counts combining marks as separate code points and renders them explicitly", () => {
    const parts = slicePronunciationText("a\u0301bc", { start: 0, end: 2 });
    expect(parts).toEqual({ prefix: "", target: "a\u0301", suffix: "bc" });
    const options = validOptions();
    options[0] = { id: "A", text: "a\u0301bc", targetSpan: { start: 0, end: 2 } };
    expect(validatePronunciationOptions(options).valid).toBe(true);
  });

  it("does not mutate options, answers, spans, or source order", () => {
    const options = [validOptions()[3], validOptions()[0], validOptions()[2], validOptions()[1]];
    const answer = { correctOptionId: " a ", accepted: ["D"] };
    const optionsSnapshot = structuredClone(options);
    const answerSnapshot = structuredClone(answer);

    validatePronunciationContract(options, answer);
    normalizePronunciationOptions(options);
    normalizePronunciationAnswer(answer);

    expect(options).toEqual(optionsSnapshot);
    expect(answer).toEqual(answerSnapshot);
  });

  it.each([
    ["missing answer", undefined, "ANSWER_REQUIRED"],
    ["null answer", null, "ANSWER_REQUIRED"],
    ["missing configured value", {}, "CORRECT_OPTION_REQUIRED"],
    ["blank configured value", { correctOptionId: " " }, "CORRECT_OPTION_REQUIRED"],
    ["numeric configured value", { correctOptionId: 1 }, "CORRECT_OPTION_REQUIRED"],
    ["non-member value", { correctOptionId: "E" }, "CORRECT_OPTION_INVALID"],
  ])("rejects %s", (_name, answer, expectedCode) => {
    expect(codes(validOptions(), answer)).toContain(expectedCode);
  });

  it("rejects a canonical answer not declared by the options", () => {
    const options = validOptions();
    options[3] = option("C", "team", 1, 3);
    expect(codes(options, { correctOptionId: "D" })).toContain(
      "CORRECT_OPTION_NOT_IN_OPTIONS",
    );
  });
});
