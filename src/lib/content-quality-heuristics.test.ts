import { describe, expect, it } from "vitest";
import {
  groupSubstantiveDuplicatePromptsForReview,
  isShortNonBlankExplanation,
  normalizeSubstantivePromptForReview,
  reviewAnswerPositionDistribution,
  SHORT_EXPLANATION_THRESHOLD,
  SUBSTANTIVE_PROMPT_MIN_LENGTH,
} from "@/lib/content-quality-heuristics";

const substantivePrompt = "This substantive prompt has enough detail.";

function promptCandidate(
  id: string,
  prompt = substantivePrompt,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    problemId: `problem-${id}`,
    type: "MCQ",
    prompt,
    ...overrides,
  };
}

describe("substantive exact-prompt normalization", () => {
  it("folds case, trims edges, collapses whitespace, and applies NFKC", () => {
    expect(normalizeSubstantivePromptForReview(
      "MCQ",
      "  Ｔhis\tSUBSTANTIVE\nprompt   has enough detail.  ",
    )).toBe("this substantive prompt has enough detail.");
    expect(normalizeSubstantivePromptForReview(
      "MCQ",
      "Cafe\u0301 compatibility normalization remains substantive.",
    )).toBe("café compatibility normalization remains substantive.");
  });

  it("defines post-NFKC edge whitespace while preserving the introduced combining mark", () => {
    const compatibilitySpacing =
      "\u00A8\t\nSubstantive prompt remains intact.";
    const explicitCombiningMark =
      "\u0308 Substantive prompt remains intact.";
    const afterNfkc = compatibilitySpacing.trim().normalize("NFKC");
    const afterWhitespaceCollapse = afterNfkc.replace(/\s+/g, " ");
    const normalized = normalizeSubstantivePromptForReview(
      "MCQ",
      compatibilitySpacing,
    );

    expect(afterNfkc).toBe(" \u0308\t\nSubstantive prompt remains intact.");
    expect(afterWhitespaceCollapse).toBe(
      " \u0308 Substantive prompt remains intact.",
    );
    expect(normalized).toBe("\u0308 substantive prompt remains intact.");
    expect(normalized).toBe(normalizeSubstantivePromptForReview(
      "MCQ",
      explicitCombiningMark,
    ));
    expect(Array.from(normalized ?? "").slice(0, 2).map((character) =>
      character.codePointAt(0),
    )).toEqual([0x0308, 0x0020]);
    expect(normalized).not.toContain("\u00A8");
  });

  it.each([
    [19, "x".repeat(19), null],
    [20, "x".repeat(20), "x".repeat(20)],
    [21, "x".repeat(21), "x".repeat(21)],
    [19, `${"😀".repeat(9)}x`, null],
    [20, "😀".repeat(10), "😀".repeat(10)],
    [21, `${"😀".repeat(10)}x`, `${"😀".repeat(10)}x`],
  ])("measures %i normalized UTF-16 code units", (_length, prompt, expected) => {
    expect(prompt).toHaveLength(_length);
    expect(normalizeSubstantivePromptForReview("MCQ", prompt)).toBe(expected);
  });

  it.each([
    ["empty", "MCQ", ""],
    ["blank", "MCQ", " \t\n "],
    ["non-string prompt", "MCQ", 20],
    ["non-string type", 1, substantivePrompt],
    ["missing prompt", "MCQ", undefined],
  ])("rejects %s input without stringification", (_label, type, prompt) => {
    expect(normalizeSubstantivePromptForReview(type, prompt)).toBeNull();
  });

  it.each(["PRONUNCIATION_ODD_ONE_OUT", "TRIOS_GAPPED_SENTENCES"])(
    "excludes the %s generic-prompt family",
    (type) => {
      expect(normalizeSubstantivePromptForReview(type, substantivePrompt))
        .toBeNull();
    },
  );

  it("preserves punctuation, digits, and diacritics after compatibility normalization", () => {
    const punctuated = normalizeSubstantivePromptForReview(
      "MCQ",
      "Résumé 2026: what is correct?",
    );
    expect(punctuated).toBe("résumé 2026: what is correct?");
    expect(punctuated).not.toBe(normalizeSubstantivePromptForReview(
      "MCQ",
      "Résumé 2026: what is correct!",
    ));
    expect(punctuated).not.toBe(normalizeSubstantivePromptForReview(
      "MCQ",
      "Resume 2026: what is correct?",
    ));
  });

  it("does not mutate caller-owned input", () => {
    const prompt = "  Caller-owned\tＰrompt remains unchanged.  ";
    const before = prompt;

    expect(normalizeSubstantivePromptForReview("MCQ", prompt)).toBe(
      "caller-owned prompt remains unchanged.",
    );
    expect(prompt).toBe(before);
    expect(SUBSTANTIVE_PROMPT_MIN_LENGTH).toBe(20);
  });
});

describe("substantive exact-prompt grouping", () => {
  it("requires at least two distinct question IDs", () => {
    expect(groupSubstantiveDuplicatePromptsForReview([
      promptCandidate("a"),
    ])).toEqual([]);
    expect(groupSubstantiveDuplicatePromptsForReview([
      promptCandidate("a"),
      promptCandidate("a"),
    ])).toEqual([]);
  });

  it("groups two or three IDs in deterministic ordinal order", () => {
    expect(groupSubstantiveDuplicatePromptsForReview([
      promptCandidate("c"),
      promptCandidate("a", substantivePrompt.toUpperCase()),
      promptCandidate("b", `  ${substantivePrompt}  `),
    ])).toEqual([{
      normalizedPrompt: substantivePrompt.toLocaleLowerCase("en"),
      members: [
        { questionId: "a", problemId: "problem-a" },
        { questionId: "b", problemId: "problem-b" },
        { questionId: "c", problemId: "problem-c" },
      ],
    }]);
  });

  it("groups across included question types but excludes generic types", () => {
    const groups = groupSubstantiveDuplicatePromptsForReview([
      promptCandidate("a", substantivePrompt, { type: "MCQ" }),
      promptCandidate("b", substantivePrompt, { type: "OPEN_CLOZE" }),
      promptCandidate("c", substantivePrompt, {
        type: "PRONUNCIATION_ODD_ONE_OUT",
      }),
      promptCandidate("d", substantivePrompt, {
        type: "TRIOS_GAPPED_SENTENCES",
      }),
    ]);

    expect(groups).toEqual([{
      normalizedPrompt: substantivePrompt.toLocaleLowerCase("en"),
      members: [
        { questionId: "a", problemId: "problem-a" },
        { questionId: "b", problemId: "problem-b" },
      ],
    }]);
  });

  it("keeps different normalized prompts in separate non-duplicate buckets", () => {
    expect(groupSubstantiveDuplicatePromptsForReview([
      promptCandidate("a", "What is correct in this complete sentence?"),
      promptCandidate("b", "What is correct in this complete sentence!"),
    ])).toEqual([]);
  });

  it("rejects inherited candidate fields", () => {
    const inherited = Object.create(promptCandidate("inherited")) as Record<
      string,
      unknown
    >;

    expect(groupSubstantiveDuplicatePromptsForReview([
      inherited,
      promptCandidate("ordinary"),
    ])).toEqual([]);
  });

  it.each(["id", "problemId", "type", "prompt"] as const)(
    "rejects an accessor-backed %s without invoking it",
    (key) => {
      let getterCalls = 0;
      const hostile = promptCandidate("hostile");
      Object.defineProperty(hostile, key, {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(`${key} getter must not run`);
        },
      });
      const descriptor = Object.getOwnPropertyDescriptor(hostile, key);

      expect(groupSubstantiveDuplicatePromptsForReview([
        hostile,
        promptCandidate("ordinary"),
      ])).toEqual([]);
      expect(getterCalls).toBe(0);
      expect(Object.getOwnPropertyDescriptor(hostile, key)).toEqual(descriptor);
    },
  );

  it("is order-independent, resolves repeated IDs deterministically, and does not mutate inputs", () => {
    const candidates = [
      promptCandidate("b"),
      promptCandidate("a", substantivePrompt.toUpperCase()),
      promptCandidate("a", "Z-prefixed competing substantive prompt."),
    ];
    const before = JSON.stringify(candidates);
    const descriptors = candidates.map((candidate) =>
      Object.getOwnPropertyDescriptors(candidate),
    );
    const forward = groupSubstantiveDuplicatePromptsForReview(candidates);
    const reversed = groupSubstantiveDuplicatePromptsForReview(
      [...candidates].reverse(),
    );

    expect(forward).toEqual(reversed);
    expect(forward[0]?.members.map((member) => member.questionId)).toEqual([
      "a",
      "b",
    ]);
    expect(JSON.stringify(candidates)).toBe(before);
    candidates.forEach((candidate, index) => {
      expect(Object.getOwnPropertyDescriptors(candidate)).toEqual(
        descriptors[index],
      );
    });
  });
});

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
