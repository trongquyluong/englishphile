import type { Question } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import {
  normalizeTriosAnswer,
  TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS,
  validateTriosAnswer,
  validateTriosContract,
  validateTriosSentences,
} from "@/lib/questions/trios-contract";

const validSentences = [
  "The committee reached a _____ after two hours.",
  "Her silence led me to the wrong _____.",
  "The evidence points to one _____.",
];
const validMetadata = {
  sentences: validSentences,
  sharedWord: "must-not-be-authoritative",
};
const validAnswer = { accepted: ["conclusion"] };

function issueCodes(metadata: unknown, answer: unknown = validAnswer) {
  return validateTriosContract(metadata, answer).issues.map((item) => item.code);
}

function checked(answer: unknown, learnerAnswer: unknown) {
  return checkQuestionAnswer(
    {
      type: "TRIOS_GAPPED_SENTENCES",
      answer,
      explanation: "Giải thích.",
    } as Pick<Question, "type" | "answer" | "explanation">,
    learnerAnswer,
  );
}

describe("Trios / Gapped Sentences shared contract", () => {
  it("returns an ordered, trimmed tuple only for exactly three canonical gaps", () => {
    const source = {
      sentences: validSentences.map((sentence) => `  ${sentence}  `),
    };
    const snapshot = structuredClone(source);
    const result = validateTriosSentences(source);

    expect(result.valid).toBe(true);
    expect(result.sentences).toEqual(validSentences);
    expect(result.sentences).toHaveLength(3);
    expect(source).toEqual(snapshot);
  });

  it.each([
    ["missing metadata", null, "METADATA_REQUIRED", "metadata"],
    ["missing sentences", {}, "SENTENCES_REQUIRED", "metadata.sentences"],
    ["non-array sentences", { sentences: "not-an-array" }, "SENTENCES_NOT_ARRAY", "metadata.sentences"],
    ["two sentences", { sentences: validSentences.slice(0, 2) }, "SENTENCE_COUNT_NOT_THREE", "metadata.sentences"],
    ["four sentences", { sentences: [...validSentences, "A fourth _____."] }, "SENTENCE_COUNT_NOT_THREE", "metadata.sentences"],
    ["empty sentence", { sentences: [validSentences[0], " ", validSentences[2]] }, "SENTENCE_EMPTY", "metadata.sentences.1"],
    ["non-string sentence", { sentences: [validSentences[0], 42, validSentences[2]] }, "SENTENCE_NOT_STRING", "metadata.sentences.1"],
    ["missing gap", { sentences: [validSentences[0], "No visible gap.", validSentences[2]] }, "GAP_MARKER_REQUIRED", "metadata.sentences.1"],
    ["two gaps", { sentences: [validSentences[0], "One _____ and another _____.", validSentences[2]] }, "GAP_MARKER_INVALID", "metadata.sentences.1"],
    ["non-canonical gap run", { sentences: [validSentences[0], "One ______ gap.", validSentences[2]] }, "GAP_MARKER_INVALID", "metadata.sentences.1"],
  ])("rejects %s without returning a partial learner tuple", (_name, metadata, code, path) => {
    const result = validateTriosSentences(metadata);

    expect(result.valid).toBe(false);
    expect(result.sentences).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, path, importLevel: "warning" }),
    ]));
  });

  it("accepts either supported answer alias and canonicalizes a valid accepted alias", () => {
    expect(validateTriosAnswer({ accepted: " conclusion " })).toEqual(
      expect.objectContaining({ valid: true, sharedAnswer: "conclusion" }),
    );
    expect(validateTriosAnswer({ acceptedAnswers: ["conclusion"] })).toEqual(
      expect.objectContaining({ valid: true, sharedAnswer: "conclusion" }),
    );
    expect(normalizeTriosAnswer({ accepted: " conclusion " })).toEqual({
      accepted: ["conclusion"],
      acceptedAnswers: ["conclusion"],
      display: "conclusion",
    });
  });

  it("accepts bounded natural apostrophe and hyphen forms", () => {
    expect(validateTriosAnswer({ accepted: ["don’t"] }).valid).toBe(true);
    expect(validateTriosAnswer({ accepted: ["mother-in-law"] }).valid).toBe(true);
    expect(validateTriosAnswer({
      accepted: ["a".repeat(TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS)],
    }).valid).toBe(true);
  });

  it.each([
    ["missing answer", null, "ANSWER_REQUIRED", "answer"],
    ["missing aliases", { display: "conclusion" }, "ACCEPTED_REQUIRED", "answer.acceptedAnswers"],
    ["blank answer", { accepted: [" "] }, "ACCEPTED_EMPTY", "answer.accepted.0"],
    ["multiple answers", { accepted: ["one", "two"] }, "ACCEPTED_COUNT_NOT_ONE", "answer.accepted"],
    ["multiword answer", { acceptedAnswers: ["in conclusion"] }, "ACCEPTED_MULTIWORD", "answer.acceptedAnswers.0"],
    ["malformed alias shape", { accepted: { word: "conclusion" } }, "ACCEPTED_SHAPE_INVALID", "answer.accepted"],
    ["malformed accepted entry", { accepted: [{ word: "conclusion" }] }, "ACCEPTED_VALUE_NOT_STRING", "answer.accepted.0"],
    ["unbounded answer", { accepted: ["a".repeat(TRIOS_ACCEPTED_WORD_MAX_CODE_POINTS + 1)] }, "ACCEPTED_TOO_LONG", "answer.accepted.0"],
    ["invalid punctuation", { accepted: ["-word"] }, "ACCEPTED_INVALID_WORD", "answer.accepted.0"],
    ["conflicting aliases", { accepted: ["one"], acceptedAnswers: ["two"] }, "ACCEPTED_ALIAS_CONFLICT", "answer"],
  ])("rejects %s as a fatal answer issue", (_name, answer, code, path) => {
    const result = validateTriosAnswer(answer);

    expect(result.valid).toBe(false);
    expect(result.sharedAnswer).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, path, importLevel: "error" }),
    ]));
  });

  it("never treats metadata.sharedWord or answer.display as scoring authority", () => {
    const result = validateTriosContract(
      { ...validMetadata, sharedWord: "conclusion" },
      { display: "conclusion" },
    );

    expect(result.valid).toBe(false);
    expect(result.sharedAnswer).toBeNull();
    expect(result.importDisposition).toBe("error");
  });

  it("classifies sentence-only defects as draft warnings and answer defects as errors", () => {
    expect(validateTriosContract(null, validAnswer).importDisposition)
      .toBe("draft-warning");
    expect(validateTriosContract(validMetadata, { accepted: [] }).importDisposition)
      .toBe("error");
  });
});

describe("Trios scoring fail-closed runtime", () => {
  it("uses deliberate text normalization for a single valid configured word", () => {
    expect(checked({ accepted: [" Conclusion "] }, "  CONCLUSION ").isCorrect)
      .toBe(true);
    expect(checked({ acceptedAnswers: ["don't"] }, "DONT").isCorrect)
      .toBe(true);
    expect(checked({ accepted: ["conclusion"] }, "wrong").isCorrect)
      .toBe(false);
  });

  it.each([
    ["blank learner answer", { accepted: ["conclusion"] }, " "],
    ["blank configured answer", { accepted: [" "] }, ""],
    ["missing accepted answer", {}, "conclusion"],
    ["multiple configured answers", { accepted: ["one", "two"] }, "one"],
    ["malformed answer object", ["conclusion"], "conclusion"],
    ["malformed accepted entry", { accepted: [{ word: "conclusion" }] }, "conclusion"],
    ["multiword configured answer", { accepted: ["in conclusion"] }, "in conclusion"],
    ["historical conflicting aliases", { accepted: ["one"], acceptedAnswers: ["two"] }, "two"],
  ])("fails closed for %s", (_name, answer, learnerAnswer) => {
    const result = checked(answer, learnerAnswer);
    expect(result.isCorrect).toBe(false);
    if (_name !== "blank learner answer") {
      expect(result.correctAnswer).toBe("—");
    }
  });

  it("does not change unrelated exact, review, or writing branches", () => {
    const openCloze = checkQuestionAnswer({
      type: "OPEN_CLOZE",
      answer: { acceptedAnswers: ["answer"] },
      explanation: null,
    } as Pick<Question, "type" | "answer" | "explanation">, "ANSWER");
    const transformation = checkQuestionAnswer({
      type: "SENTENCE_TRANSFORMATION",
      answer: { acceptedAnswers: ["model answer"] },
      explanation: null,
    } as Pick<Question, "type" | "answer" | "explanation">, "different");
    const writing = checkQuestionAnswer({
      type: "WRITING_PROMPT",
      answer: { rubric: [] },
      explanation: null,
    } as Pick<Question, "type" | "answer" | "explanation">, "essay");

    expect(openCloze.isCorrect).toBe(true);
    expect(transformation.isCorrect).toBeNull();
    expect(writing.isCorrect).toBeNull();
  });

  it("reports all sentence defect codes without using passage fallback", () => {
    const metadata = {
      sentences: ["No gap.", validSentences[1], validSentences[2]],
    };
    expect(issueCodes(metadata)).toContain("GAP_MARKER_REQUIRED");
  });
});
