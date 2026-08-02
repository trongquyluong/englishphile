import type { Question } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  checkExactMatch,
  checkMultipleAcceptedAnswers,
  checkQuestionAnswer,
  checkTextAnswer,
  getProblemStatusFromSubmission,
  getSubmissionStatus,
  normalizeAnswer,
} from "@/lib/answer-checking";

const ASCII_APOSTROPHE = "\u0027";
const LEFT_SINGLE_QUOTE = "\u2018";
const RIGHT_SINGLE_QUOTE = "\u2019";

const APOSTROPHE_FORMS = [
  ["U+0027", ASCII_APOSTROPHE],
  ["U+2018", LEFT_SINGLE_QUOTE],
  ["U+2019", RIGHT_SINGLE_QUOTE],
] as const;

const APOSTROPHE_COMBINATIONS = APOSTROPHE_FORMS.flatMap(
  ([storedName, stored]) =>
    APOSTROPHE_FORMS.map(([learnerName, learner]) => ({
      learner,
      learnerName,
      stored,
      storedName,
    })),
);

const straight = `didn${ASCII_APOSTROPHE}t discuss`;
const leftCurly = `didn${LEFT_SINGLE_QUOTE}t discuss`;
const rightCurly = `didn${RIGHT_SINGLE_QUOTE}t discuss`;

function scoreQuestion(
  type: Question["type"],
  answer: Question["answer"],
  studentAnswer: unknown,
  options?: unknown,
) {
  return checkQuestionAnswer(
    {
      type,
      answer,
      explanation: "Giải thích kiểm thử.",
      options,
    },
    studentAnswer,
  );
}

describe("normalizeAnswer", () => {
  it("normalizes all three apostrophe code points identically", () => {
    expect(normalizeAnswer(straight)).toBe("didnt discuss");
    expect(normalizeAnswer(leftCurly)).toBe("didnt discuss");
    expect(normalizeAnswer(rightCurly)).toBe("didnt discuss");
  });

  it("normalizes possessives and contractions across straight and curly forms", () => {
    expect(normalizeAnswer(`writer${ASCII_APOSTROPHE}s attitude`)).toBe(
      normalizeAnswer(`writer${RIGHT_SINGLE_QUOTE}s attitude`),
    );
    expect(normalizeAnswer(`can${ASCII_APOSTROPHE}t`)).toBe(
      normalizeAnswer(`can${RIGHT_SINGLE_QUOTE}t`),
    );
  });

  it("preserves the existing case, whitespace, punctuation, quote, and accent policy", () => {
    expect(normalizeAnswer("  A   Mixed CASE  ")).toBe("a mixed case");
    expect(normalizeAnswer("Answer.?!,;:()[]{}")).toBe("answer");
    expect(normalizeAnswer('\"Answer\"')).toBe("answer");
    expect(normalizeAnswer("\u201CAnswer\u201D")).toBe("answer");
    expect(normalizeAnswer("caf\u00E9")).toBe(normalizeAnswer("cafe\u0301"));
  });

  it.each([
    ["re-sign", "resign"],
    ["a/b", "ab"],
    ["under_score", "underscore"],
    ["2025", "2026"],
    ["cannot", "can not"],
    ["didn discuss", straight],
  ])("does not over-normalize %s and %s", (first, second) => {
    expect(normalizeAnswer(first)).not.toBe(normalizeAnswer(second));
  });

  it("leaves punctuation outside the bounded class intact", () => {
    expect(normalizeAnswer("re-sign / under_score — 2+2=4")).toBe(
      "re-sign / under_score — 2+2=4",
    );
  });
});

describe("exact and multiple-answer helpers", () => {
  it.each(APOSTROPHE_COMBINATIONS)(
    "matches stored $storedName with learner $learnerName",
    ({ learner, stored }) => {
      expect(
        checkExactMatch(
          `didn${learner}t discuss`,
          `didn${stored}t discuss`,
        ),
      ).toBe(true);
    },
  );

  it("keeps existing exact-match equivalences", () => {
    expect(checkExactMatch(" ANSWER. ", "answer")).toBe(true);
    expect(checkExactMatch("two   words", "two words")).toBe(true);
    expect(checkExactMatch("\u201Cquoted\u201D", '\"quoted\"')).toBe(true);
    expect(checkExactMatch("caf\u00E9", "cafe\u0301")).toBe(true);
  });

  it("checks all accepted answers through the production exact matcher", () => {
    const accepted = ["other", rightCurly];
    const snapshot = structuredClone(accepted);

    expect(checkMultipleAcceptedAnswers(straight, accepted)).toBe(true);
    expect(checkTextAnswer(straight, accepted)).toBe(true);
    expect(checkMultipleAcceptedAnswers("different", accepted)).toBe(false);
    expect(accepted).toEqual(snapshot);
  });
});

describe("Error Identification Q23 regression", () => {
  const configuredAnswer = {
    correctPart: "B",
    correction: rightCurly,
  };

  it("scores stored U+2019 against learner U+0027", () => {
    expect(
      scoreQuestion("ERROR_IDENTIFICATION", configuredAnswer, {
        part: "B",
        correction: straight,
      }).isCorrect,
    ).toBe(true);
  });

  it("scores the reverse configured/learner direction", () => {
    expect(
      scoreQuestion(
        "ERROR_IDENTIFICATION",
        { correctPart: "B", correction: straight },
        { part: "B", correction: rightCurly },
      ).isCorrect,
    ).toBe(true);
  });

  it("requires the correct selected part even with an equivalent correction", () => {
    expect(
      scoreQuestion("ERROR_IDENTIFICATION", configuredAnswer, {
        part: "A",
        correction: straight,
      }).isCorrect,
    ).toBe(false);
  });

  it.each([
    ["blank correction", { part: "B", correction: "" }],
    ["missing correction", { part: "B" }],
    ["OK", { part: "B", correction: "OK" }],
    ["missing contraction", { part: "B", correction: "did discuss" }],
    ["missing letter", { part: "B", correction: "didn discuss" }],
    ["different word", { part: "B", correction: "couldnt discuss" }],
    ["different word order", { part: "B", correction: "discuss didnt" }],
    ["punctuation only", { part: "B", correction: ".?!" }],
    ["null object", null],
    ["string instead of object", straight],
    ["array instead of object", ["B", straight]],
  ])("fails closed for %s", (_name, studentAnswer) => {
    expect(
      scoreQuestion(
        "ERROR_IDENTIFICATION",
        configuredAnswer,
        studentAnswer,
      ).isCorrect,
    ).toBe(false);
  });

  it("does not mutate the configured or learner answer objects", () => {
    const answer = { correctPart: "B", correction: rightCurly };
    const studentAnswer = { part: "B", correction: straight };
    const answerSnapshot = structuredClone(answer);
    const studentSnapshot = structuredClone(studentAnswer);

    scoreQuestion("ERROR_IDENTIFICATION", answer, studentAnswer);

    expect(answer).toEqual(answerSnapshot);
    expect(studentAnswer).toEqual(studentSnapshot);
  });
});

describe("production scoring branches", () => {
  it.each([
    "OPEN_CLOZE",
    "WORD_FORMATION",
    "SHORT_ANSWER",
    "LISTENING_SHORT_ANSWER",
  ] as const)("applies apostrophe equivalence to %s", (type) => {
    expect(
      scoreQuestion(type, { acceptedAnswers: [rightCurly] }, straight)
        .isCorrect,
    ).toBe(true);
  });

  it("applies apostrophe equivalence to a valid Trios answer", () => {
    expect(
      scoreQuestion(
        "TRIOS_GAPPED_SENTENCES",
        { accepted: [`don${RIGHT_SINGLE_QUOTE}t`] },
        `don${ASCII_APOSTROPHE}t`,
      ).isCorrect,
    ).toBe(true);
  });

  it("keeps exact and non-exact Sentence Transformation behavior", () => {
    const answer = { acceptedAnswers: [rightCurly] };

    expect(
      scoreQuestion("SENTENCE_TRANSFORMATION", answer, straight).isCorrect,
    ).toBe(true);
    expect(
      scoreQuestion("SENTENCE_TRANSFORMATION", answer, "did discuss")
        .isCorrect,
    ).toBeNull();
  });

  it("does not change ordinary MCQ scoring", () => {
    const answer = { correctOptionId: "B" };

    expect(scoreQuestion("MCQ", answer, " b ").isCorrect).toBe(true);
    expect(scoreQuestion("MCQ", answer, "A").isCorrect).toBe(false);
  });

  it("keeps Pronunciation scoring gated by its complete contract", () => {
    const options = [
      { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
      { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
      { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
      { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
    ];

    expect(
      scoreQuestion(
        "PRONUNCIATION_ODD_ONE_OUT",
        { correctOptionId: "C" },
        "C",
        options,
      ).isCorrect,
    ).toBe(true);
    expect(
      scoreQuestion(
        "PRONUNCIATION_ODD_ONE_OUT",
        { correctOptionId: "C" },
        "C",
      ).isCorrect,
    ).toBe(false);
  });

  it("keeps Writing non-auto-scored", () => {
    expect(
      scoreQuestion("WRITING_PROMPT", { rubric: [] }, "Learner essay")
        .isCorrect,
    ).toBeNull();
  });

  it("keeps submission and problem status calculation unchanged", () => {
    expect(getSubmissionStatus([])).toBe("NEEDS_REVIEW");
    expect(getSubmissionStatus([{ isCorrect: null }])).toBe("NEEDS_REVIEW");
    expect(getSubmissionStatus([{ isCorrect: true }])).toBe("ACCEPTED");
    expect(getSubmissionStatus([{ isCorrect: false }])).toBe("WRONG_ANSWER");
    expect(
      getSubmissionStatus([{ isCorrect: true }, { isCorrect: false }]),
    ).toBe("PARTIAL");
    expect(getProblemStatusFromSubmission("ACCEPTED")).toBe("SOLVED");
    expect(getProblemStatusFromSubmission("NEEDS_REVIEW")).toBe(
      "NEEDS_REVIEW",
    );
    expect(getProblemStatusFromSubmission("WRONG_ANSWER")).toBe("WRONG");
    expect(getProblemStatusFromSubmission("PARTIAL")).toBe("ATTEMPTED");
  });
});
