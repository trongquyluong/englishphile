import { describe, expect, it } from "vitest";
import type { Question } from "@prisma/client";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import {
  ERROR_IDENTIFICATION_CORRECTION_LIMITS,
  normalizeErrorIdentificationAnswer,
  normalizeErrorIdentificationOptions,
  validateErrorIdentificationContract,
  validateErrorIdentificationOptions,
} from "@/lib/questions/error-identification-contract";

const validOptions = [
  { id: "A", text: "The students" },
  { id: "B", text: "was" },
  { id: "C", text: "ready" },
  { id: "D", text: "today" },
];

function issueCodes(options: unknown, answer: unknown) {
  return validateErrorIdentificationContract(options, answer).issues.map(
    (candidate) => candidate.code,
  );
}

function checked(answer: unknown, studentAnswer: unknown) {
  return checkQuestionAnswer(
    {
      type: "ERROR_IDENTIFICATION",
      answer,
      explanation: "Giải thích.",
    } as Pick<Question, "type" | "answer" | "explanation">,
    studentAnswer,
  );
}

describe("Error Identification canonical contract", () => {
  it("accepts exactly four A-D parts, a member correctPart, and correction", () => {
    const result = validateErrorIdentificationContract(validOptions, {
      correctPart: "B",
      correction: "were",
    });

    expect(result.valid).toBe(true);
    expect(result.importDisposition).toBe("valid");
    expect(result.options).toEqual(validOptions);
  });

  it.each([
    ["missing", null, "OPTIONS_REQUIRED"],
    ["fewer than four", validOptions.slice(0, 3), "OPTION_COUNT_NOT_FOUR"],
    ["more than four", [...validOptions, { id: "A", text: "extra" }], "OPTION_COUNT_NOT_FOUR"],
    [
      "duplicate IDs",
      [validOptions[0], { id: "A", text: "duplicate" }, validOptions[2], validOptions[3]],
      "DUPLICATE_OPTION_ID",
    ],
    [
      "non A-D ID",
      [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "other" }],
      "INVALID_OPTION_ID",
    ],
    [
      "missing display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D" }],
      "INVALID_OPTION_TEXT",
    ],
    [
      "invalid display text type",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: {} }],
      "INVALID_OPTION_TEXT",
    ],
  ])("rejects %s", (_name, options, expectedCode) => {
    expect(issueCodes(options, { correctPart: "A", correction: "replacement" }))
      .toContain(expectedCode);
  });

  it("canonicalizes lowercase and surrounding whitespace without changing text", () => {
    const result = validateErrorIdentificationOptions([
      { id: " a ", text: 1 },
      { id: "b", text: "two" },
      { id: " C", text: "three" },
      { id: "d ", text: "four" },
    ]);

    expect(result.valid).toBe(true);
    expect(result.options).toEqual([
      { id: "A", text: "1" },
      { id: "B", text: "two" },
      { id: "C", text: "three" },
      { id: "D", text: "four" },
    ]);
  });

  it("orders an arbitrary valid source order as canonical A-D", () => {
    const result = validateErrorIdentificationOptions([
      { id: "D", text: "four" },
      { id: " b ", text: "two" },
      { id: "A", text: "one" },
      { id: "c", text: "three" },
    ]);

    expect(result.valid).toBe(true);
    expect(result.options).toEqual([
      { id: "A", text: "one" },
      { id: "B", text: "two" },
      { id: "C", text: "three" },
      { id: "D", text: "four" },
    ]);
  });

  it("detects scorer-equivalent IDs after whitespace/case canonicalization", () => {
    const result = validateErrorIdentificationOptions([
      { id: "A", text: "one" },
      { id: " a ", text: "duplicate" },
      { id: "C", text: "three" },
      { id: "D", text: "four" },
    ]);

    expect(result.issues.map((candidate) => candidate.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_OPTION_ID", "MISSING_CANONICAL_OPTION_ID"]),
    );
  });

  it("rejects a correctPart absent from the canonical option set", () => {
    expect(issueCodes(validOptions, { correctPart: "Z", correction: "replacement" }))
      .toContain("CORRECT_PART_INVALID");
  });

  it("normalizes the supported errorPart alias into canonical correctPart", () => {
    const answer = normalizeErrorIdentificationAnswer({
      errorPart: " b ",
      correction: " were ",
      marker: "kept",
    });

    expect(answer).toEqual({
      correctPart: "B",
      correction: "were",
      marker: "kept",
    });
    expect(JSON.stringify(answer)).not.toContain("errorPart");
  });

  it("keeps an existing string correctPart authoritative over errorPart", () => {
    expect(normalizeErrorIdentificationAnswer({
      correctPart: " ",
      errorPart: "A",
      correction: "replacement",
    })).toEqual({ correctPart: "", correction: "replacement" });
  });

  it("treats missing or blank correction as an import error and publication blocker", () => {
    const missing = validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
    });
    const blank = validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: " ",
    });

    expect(missing.importDisposition).toBe("error");
    expect(blank.importDisposition).toBe("error");
    expect(missing.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CORRECTION_REQUIRED", importLevel: "error" }),
    ]));
  });

  it("bounds slash-delimited correction alternatives without adding a new answer field", () => {
    const tooMany = Array.from(
      { length: ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariants + 1 },
      (_, index) => `variant ${index}`,
    ).join(" / ");
    const emptyVariant = validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: "first / / second",
    });
    const excessive = validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: tooMany,
    });

    expect(emptyVariant.issues.map((candidate) => candidate.code))
      .toContain("CORRECTION_EMPTY_VARIANT");
    expect(excessive.issues.map((candidate) => candidate.code))
      .toContain("TOO_MANY_CORRECTION_VARIANTS");
  });

  it("accepts and rejects correction values at every exact boundary", () => {
    const eightVariants = Array.from({ length: 8 }, (_, index) => `v${index}`)
      .join("/");
    const nineVariants = `${eightVariants}/v8`;
    const exactly240 = "x".repeat(240);
    const over240 = "x".repeat(241);
    const exactly1000 = [
      "a".repeat(200),
      "b".repeat(200),
      "c".repeat(200),
      "d".repeat(200),
      "e".repeat(196),
    ].join("/");
    const over1000 = `${exactly1000}x`;

    expect(validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: eightVariants,
    }).valid).toBe(true);
    expect(issueCodes(validOptions, {
      correctPart: "A",
      correction: nineVariants,
    })).toContain("TOO_MANY_CORRECTION_VARIANTS");
    expect(validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: exactly240,
    }).valid).toBe(true);
    expect(issueCodes(validOptions, {
      correctPart: "A",
      correction: over240,
    })).toContain("CORRECTION_VARIANT_TOO_LONG");
    expect(exactly1000).toHaveLength(1000);
    expect(validateErrorIdentificationContract(validOptions, {
      correctPart: "A",
      correction: exactly1000,
    }).valid).toBe(true);
    expect(over1000).toHaveLength(1001);
    expect(issueCodes(validOptions, {
      correctPart: "A",
      correction: over1000,
    })).toContain("CORRECTION_TOO_LONG");
  });

  it.each([
    ["leading slash", "/fixed"],
    ["trailing slash", "fixed/"],
    ["repeated slash", "first//second"],
  ])("rejects an empty correction segment from %s", (_name, correction) => {
    expect(issueCodes(validOptions, { correctPart: "A", correction }))
      .toContain("CORRECTION_EMPTY_VARIANT");
  });

  it("scores canonical part plus any supported correction alternative", () => {
    const answer = { correctPart: "B", correction: "were / had been" };
    expect(checked(answer, { part: " b ", correction: "WERE" }).isCorrect).toBe(true);
    expect(checked(answer, { part: "B", correction: "had been" }).isCorrect).toBe(true);
  });

  it("requires both part and correction for a correct score", () => {
    const answer = { correctPart: "B", correction: "were / had been" };
    expect(checked(answer, { part: "A", correction: "were" }).isCorrect).toBe(false);
    expect(checked(answer, { part: "B", correction: "is" }).isCorrect).toBe(false);
    expect(checked(answer, { part: "B" }).isCorrect).toBe(false);
    expect(checked({ correctPart: "B", correction: "" }, { part: "B", correction: "" }).isCorrect).toBe(false);
  });

  it("fails closed unless configured and submitted parts are canonical A-D members", () => {
    expect(checked(
      { correctPart: "OK", correction: "fixed" },
      { part: " ok ", correction: "fixed" },
    ).isCorrect).toBe(false);
    expect(checked(
      { correctPart: "A", correction: "fixed" },
      { part: " a ", correction: "fixed" },
    ).isCorrect).toBe(true);
    expect(checked(
      { correctPart: "A", correction: "fixed" },
      { part: "OK", correction: "fixed" },
    ).isCorrect).toBe(false);
    expect(checked(
      { correctPart: "A", correction: "fixed" },
      { part: "B", correction: "fixed" },
    ).isCorrect).toBe(false);
  });

  it.each([
    ["blank", ""],
    ["null", null],
    ["object", { id: "A" }],
    ["array", ["A"]],
    ["boolean", true],
  ])("rejects a %s submitted part", (_name, part) => {
    expect(checked(
      { correctPart: "A", correction: "fixed" },
      { part, correction: "fixed" },
    ).isCorrect).toBe(false);
  });

  it("normalizes supported import primitives but does not synthesize missing parts", () => {
    expect(normalizeErrorIdentificationOptions([
      { label: " a ", text: 1 },
      { id: "b", text: "two" },
    ])).toEqual([
      { label: " a ", id: "A", text: "1" },
      { id: "B", text: "two" },
    ]);
    expect(normalizeErrorIdentificationOptions(null)).toBeNull();
  });
});
