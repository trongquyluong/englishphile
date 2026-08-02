import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  getContentQaReport,
  getPublishableProblemIds,
} from "@/lib/content-packs/qa";

const validOptions = [
  { id: "A", text: "The students" },
  { id: "B", text: "was" },
  { id: "C", text: "ready" },
  { id: "D", text: "today" },
];

function storedProblem(
  options: unknown,
  answer: unknown = { correctPart: "B", correction: "were" },
) {
  return {
    id: "problem-error",
    title: "Error Identification QA fixture",
    slug: "error-identification-qa-fixture",
    contentStatus: "NEEDS_REVIEW",
    statement: "Chọn phần sai và sửa lại.",
    instructions: "Chọn một phần A-D.",
    estimatedMinutes: 5,
    questionType: "ERROR_IDENTIFICATION",
    sourceCollection: { id: "source", name: "Synthetic source" },
    problemTopics: [{ topic: { id: "topic", name: "Grammar", slug: "grammar" } }],
    questions: [{
      id: "question-error",
      problemId: "problem-error",
      type: "ERROR_IDENTIFICATION",
      skillType: "ERROR_IDENTIFICATION",
      difficulty: "C1",
      prompt: "The students was ready today.",
      passage: null,
      options,
      answer,
      explanation: "Students là chủ ngữ số nhiều.",
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata: null,
      contentStatus: "NEEDS_REVIEW",
      reviewedAt: null,
      reviewedById: null,
      orderIndex: 2,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }],
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function database(problem: unknown) {
  const questions = (problem as { questions?: unknown[] }).questions ?? [];
  return {
    problem: {
      findMany: vi.fn().mockResolvedValue([problem]),
    },
    question: {
      findMany: vi.fn().mockResolvedValue(questions.map(narrowQuestion)),
    },
  };
}

function narrowQuestion(value: unknown) {
  const question = value as {
    id: string;
    problemId: string;
    type: string;
    prompt: string;
  };
  return {
    id: question.id,
    problemId: question.problemId,
    type: question.type,
    prompt: question.prompt,
  };
}

describe("persisted Error Identification QA", () => {
  it("marks a complete A-D contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(validOptions)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR"))
      .toEqual([]);
  });

  it.each([
    ["legacy null options", null, "ERROR_IDENTIFICATION_OPTIONS_REQUIRED", "questions.2.options"],
    [
      "fewer than four options",
      validOptions.slice(0, 3),
      "ERROR_IDENTIFICATION_OPTION_COUNT_NOT_FOUR",
      "questions.2.options",
    ],
    [
      "more than four options",
      [...validOptions, { id: "A", text: "extra" }],
      "ERROR_IDENTIFICATION_OPTION_COUNT_NOT_FOUR",
      "questions.2.options",
    ],
    [
      "duplicate IDs",
      [validOptions[0], { id: " a ", text: "duplicate" }, validOptions[2], validOptions[3]],
      "ERROR_IDENTIFICATION_DUPLICATE_OPTION_ID",
      "questions.2.options",
    ],
    [
      "missing ID",
      [validOptions[0], validOptions[1], validOptions[2], { text: "today" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
      "questions.2.options.3.id",
    ],
    [
      "non A-D ID",
      [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "today" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_ID",
      "questions.2.options.3.id",
    ],
    [
      "missing display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: "" }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
      "questions.2.options.3.text",
    ],
    [
      "malformed display text",
      [validOptions[0], validOptions[1], validOptions[2], { id: "D", text: {} }],
      "ERROR_IDENTIFICATION_INVALID_OPTION_TEXT",
      "questions.2.options.3.text",
    ],
  ])("blocks %s with an actionable persisted location", async (_name, options, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(options)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        problemId: "problem-error",
        entityId: "question-error",
        path,
      }),
    ]));
  });

  it.each([
    [
      "missing correctPart",
      { correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED",
      "questions.2.answer.correctPart",
    ],
    [
      "blank correctPart",
      { correctPart: " ", correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_REQUIRED",
      "questions.2.answer.correctPart",
    ],
    [
      "non-member correctPart",
      { correctPart: "OK", correction: "were" },
      "ERROR_IDENTIFICATION_CORRECT_PART_INVALID",
      "questions.2.answer.correctPart",
    ],
    [
      "missing correction",
      { correctPart: "B" },
      "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      "questions.2.answer.correction",
    ],
    [
      "blank correction",
      { correctPart: "B", correction: " " },
      "ERROR_IDENTIFICATION_CORRECTION_REQUIRED",
      "questions.2.answer.correction",
    ],
    [
      "too many correction variants",
      {
        correctPart: "B",
        correction: Array.from({ length: 9 }, (_, index) => `v${index}`).join("/"),
      },
      "ERROR_IDENTIFICATION_TOO_MANY_CORRECTION_VARIANTS",
      "questions.2.answer.correction",
    ],
    [
      "overlong correction variant",
      { correctPart: "B", correction: "x".repeat(241) },
      "ERROR_IDENTIFICATION_CORRECTION_VARIANT_TOO_LONG",
      "questions.2.answer.correction",
    ],
    [
      "overlong total correction",
      {
        correctPart: "B",
        correction: [
          "a".repeat(200),
          "b".repeat(200),
          "c".repeat(200),
          "d".repeat(200),
          "e".repeat(197),
        ].join("/"),
      },
      "ERROR_IDENTIFICATION_CORRECTION_TOO_LONG",
      "questions.2.answer.correction",
    ],
    [
      "empty slash segment",
      { correctPart: "B", correction: "were//had been" },
      "ERROR_IDENTIFICATION_CORRECTION_EMPTY_VARIANT",
      "questions.2.answer.correction",
    ],
  ])("blocks %s independently of valid options", async (_name, answer, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(validOptions, answer)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        path,
      }),
    ]));
  });

  it("blocks a correctPart that is absent from malformed persisted options", async () => {
    const report = await getContentQaReport(
      {},
      database(storedProblem(
        [validOptions[0], validOptions[1], validOptions[2], { id: "Z", text: "today" }],
        { correctPart: "D", correction: "were" },
      )) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code: "ERROR_IDENTIFICATION_CORRECT_PART_NOT_IN_OPTIONS",
        path: "questions.2.answer.correctPart",
      }),
    ]));
  });
});

const validTriosSentences = [
  "The committee reached a _____ after two hours.",
  "Her silence led me to the wrong _____.",
  "The evidence points to one _____.",
];

function storedTriosProblem(
  metadata: unknown,
  answer: unknown = { acceptedAnswers: ["conclusion"] },
) {
  const base = storedProblem(null);
  return {
    ...base,
    id: "problem-trios",
    title: "Trios QA fixture",
    slug: "trios-qa-fixture",
    statement: "Điền một từ chung.",
    instructions: "Dùng đúng một từ.",
    questionType: "TRIOS_GAPPED_SENTENCES",
    questions: [{
      ...base.questions[0],
      id: "question-trios",
      problemId: "problem-trios",
      type: "TRIOS_GAPPED_SENTENCES",
      skillType: "TRIOS",
      prompt: "Điền một từ duy nhất.",
      options: null,
      answer,
      metadata,
      orderIndex: 4,
    }],
  };
}

describe("persisted Trios QA", () => {
  it("marks the complete canonical contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem({
        sentences: validTriosSentences,
        sharedWord: "not-authoritative",
      })) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR"))
      .toEqual([]);
  });

  it.each([
    ["missing metadata", null, "TRIOS_METADATA_REQUIRED", "questions.4.metadata"],
    ["missing sentences", {}, "TRIOS_SENTENCES_REQUIRED", "questions.4.metadata.sentences"],
    ["wrong count", { sentences: validTriosSentences.slice(0, 2) }, "TRIOS_SENTENCE_COUNT_NOT_THREE", "questions.4.metadata.sentences"],
    ["malformed entry", { sentences: [validTriosSentences[0], 2, validTriosSentences[2]] }, "TRIOS_SENTENCE_NOT_STRING", "questions.4.metadata.sentences.1"],
    ["wrong gap count", { sentences: [validTriosSentences[0], "Two _____ gaps _____.", validTriosSentences[2]] }, "TRIOS_GAP_MARKER_INVALID", "questions.4.metadata.sentences.1"],
  ])("blocks %s with an exact persisted path", async (_name, metadata, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem(metadata)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        problemId: "problem-trios",
        entityId: "question-trios",
        path,
      }),
    ]));
  });

  it.each([
    ["missing answer", {}, "TRIOS_ACCEPTED_REQUIRED", "questions.4.answer.acceptedAnswers"],
    ["blank answer", { accepted: [" "] }, "TRIOS_ACCEPTED_EMPTY", "questions.4.answer.accepted.0"],
    ["multiple answers", { acceptedAnswers: ["one", "two"] }, "TRIOS_ACCEPTED_COUNT_NOT_ONE", "questions.4.answer.acceptedAnswers"],
    ["multiword answer", { accepted: ["in conclusion"] }, "TRIOS_ACCEPTED_MULTIWORD", "questions.4.answer.accepted.0"],
    ["malformed answer", ["conclusion"], "TRIOS_ANSWER_REQUIRED", "questions.4.answer"],
  ])("blocks %s independently of valid sentences", async (_name, answer, code, path) => {
    const report = await getContentQaReport(
      {},
      database(storedTriosProblem({ sentences: validTriosSentences }, answer)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "ERROR", code, path }),
    ]));
  });
});

const validPronunciationOptions = [
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
];

function storedPronunciationProblem(
  options: unknown,
  answer: unknown = { correctOptionId: "C" },
) {
  const base = storedProblem(null);
  return {
    ...base,
    id: "problem-pronunciation",
    title: "Pronunciation QA fixture",
    slug: "pronunciation-qa-fixture",
    statement: "Chọn từ có phần gạch chân phát âm khác.",
    instructions: "Chọn một đáp án.",
    questionType: "PRONUNCIATION_ODD_ONE_OUT",
    questions: [{
      ...base.questions[0],
      id: "question-pronunciation",
      problemId: "problem-pronunciation",
      type: "PRONUNCIATION_ODD_ONE_OUT",
      skillType: "PRONUNCIATION",
      prompt: "Chọn một từ.",
      options,
      answer,
      metadata: { focus: "not-authoritative" },
      orderIndex: 3,
    }],
  };
}

describe("persisted Pronunciation QA", () => {
  it("marks a complete canonical target contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedPronunciationProblem(validPronunciationOptions)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR"))
      .toEqual([]);
  });

  it.each([
    ["missing spans", validPronunciationOptions.map(({ id, text }) => ({ id, text })), "PRONUNCIATION_TARGET_SPAN_REQUIRED", "questions.3.options.0.targetSpan"],
    ["malformed span", [{ ...validPronunciationOptions[0], targetSpan: { start: 2, end: 2 } }, ...validPronunciationOptions.slice(1)], "PRONUNCIATION_TARGET_SPAN_RANGE_INVALID", "questions.3.options.0.targetSpan"],
    ["invalid text", [{ ...validPronunciationOptions[0], text: {} }, ...validPronunciationOptions.slice(1)], "PRONUNCIATION_INVALID_OPTION_TEXT", "questions.3.options.0.text"],
    ["incomplete options", validPronunciationOptions.slice(0, 3), "PRONUNCIATION_OPTION_COUNT_NOT_FOUR", "questions.3.options"],
  ])("blocks %s with exact safe location and code", async (_name, options, code, expectedPath) => {
    const report = await getContentQaReport(
      {},
      database(storedPronunciationProblem(options)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        problemId: "problem-pronunciation",
        entityId: "question-pronunciation",
        path: expectedPath,
      }),
    ]));
  });

  it.each([
    ["missing answer", null, "PRONUNCIATION_ANSWER_REQUIRED", "questions.3.answer"],
    ["blank answer", { correctOptionId: " " }, "PRONUNCIATION_CORRECT_OPTION_REQUIRED", "questions.3.answer.correctOptionId"],
    ["non-member answer", { correctOptionId: "E" }, "PRONUNCIATION_CORRECT_OPTION_INVALID", "questions.3.answer.correctOptionId"],
  ])("blocks %s independently of valid options", async (_name, answer, code, expectedPath) => {
    const report = await getContentQaReport(
      {},
      database(storedPronunciationProblem(validPronunciationOptions, answer)) as never,
    );

    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
        path: expectedPath,
      }),
    ]));
  });
});

const validListeningMetadata = {
  listening: {
    version: 1,
    audio: {
      assetRef: "/media/listening/pilot-001/dialogue-01-v1.mp3",
      mimeType: "audio/mpeg",
      byteLength: 2457600,
      durationMs: 92000,
    },
    transcript: {
      text: "Transcript",
      languageTag: "en",
      availabilityPolicy: "AFTER_SUBMISSION",
    },
    attribution: {
      displayText: "Attribution",
    },
    rights: {
      classification: "OWNED",
      evidenceRef: "rights:1",
    },
    unavailableBehavior: "BLOCK_PROBLEM",
  },
};

function storedListeningProblem(type: "LISTENING_MCQ" | "LISTENING_SHORT_ANSWER", options: unknown, answer: unknown, metadata: unknown = validListeningMetadata) {
  return {
    id: "problem-listening",
    title: "Listening QA fixture",
    slug: "listening-qa-fixture",
    contentStatus: "NEEDS_REVIEW",
    statement: "Listen and answer.",
    instructions: "Choose the correct option.",
    estimatedMinutes: 5,
    questionType: type,
    sourceCollection: { id: "source", name: "Synthetic source" },
    problemTopics: [{ topic: { id: "topic", name: "Listening", slug: "listening" } }],
    questions: [{
      id: "question-listening",
      problemId: "problem-listening",
      type: type,
      skillType: "LISTENING",
      difficulty: "C1",
      prompt: "Question prompt?",
      passage: null,
      options,
      answer,
      explanation: "Explanation.",
      rootWord: null,
      keyword: null,
      targetSentence: null,
      lineNumber: null,
      metadata,
      contentStatus: "NEEDS_REVIEW",
      reviewedAt: null,
      reviewedById: null,
      orderIndex: 4,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }],
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("persisted Listening QA", () => {
  it("marks a complete LISTENING_MCQ contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedListeningProblem("LISTENING_MCQ", [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], { correctOptionId: "B" })) as never,
    );
    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR")).toEqual([]);
  });

  it("marks a complete LISTENING_SHORT_ANSWER contract publishable", async () => {
    const report = await getContentQaReport(
      {},
      database(storedListeningProblem("LISTENING_SHORT_ANSWER", null, { acceptedAnswers: ["answer"] })) as never,
    );
    expect(report.problems[0]?.canPublish).toBe(true);
    expect(report.issues.filter((candidate) => candidate.severity === "ERROR")).toEqual([]);
  });

  it("blocks invalid MCQ answer with QA ERROR", async () => {
    const report = await getContentQaReport(
      {},
      database(storedListeningProblem("LISTENING_MCQ", [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], { correctOptionId: "Z" })) as never,
    );
    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code: "LISTENING_MCQ_CORRECT_OPTION_NOT_IN_OPTIONS",
        problemId: "problem-listening",
        entityId: "question-listening",
      }),
    ]));
  });

  it("blocks invalid Short Answer with QA ERROR", async () => {
    const report = await getContentQaReport(
      {},
      database(storedListeningProblem("LISTENING_SHORT_ANSWER", null, { acceptedAnswers: [] })) as never,
    );
    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code: "LISTENING_SHORT_ACCEPTED_REQUIRED",
        problemId: "problem-listening",
        entityId: "question-listening",
      }),
    ]));
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  it.each([
    ["Asset-reference defect", "LISTENING_ASSET_REF_INVALID", (m: any) => { m.listening.audio.assetRef = "invalid"; }],
    ["MIME defect", "LISTENING_MIME_UNSUPPORTED", (m: any) => { m.listening.audio.mimeType = "invalid"; }],
    ["Duration/size defect", "LISTENING_DURATION_INVALID", (m: any) => { m.listening.audio.durationMs = -1; }],
    ["Transcript/control defect", "LISTENING_TRANSCRIPT_TEXT_INVALID", (m: any) => { m.listening.transcript.text = ""; }],
    ["Attribution/rights defect", "LISTENING_RIGHTS_EVIDENCE_INVALID", (m: any) => { m.listening.rights.evidenceRef = ""; }],
  ])("blocks %s with QA ERROR and makes canPublish=false", async (_name, code, mutate) => {
  /* eslint-enable @typescript-eslint/no-explicit-any */
    const defectiveMetadata = JSON.parse(JSON.stringify(validListeningMetadata));
    mutate(defectiveMetadata);
    const report = await getContentQaReport(
      {},
      database(storedListeningProblem("LISTENING_MCQ", [{ id: "A", text: "A" }, { id: "B", text: "B" }, { id: "C", text: "C" }], { correctOptionId: "B" }, defectiveMetadata)) as never,
    );
    expect(report.problems[0]?.canPublish).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "ERROR",
        code,
      }),
    ]));
  });
});

const completeExplanation =
  "Giải thích này đủ dài để không kích hoạt tín hiệu rà soát độ dài.";

function storedMcqProblem(
  positions: string[],
  questionOverrides: Array<Record<string, unknown>> = [],
) {
  const base = storedProblem(validOptions);
  return {
    ...base,
    id: "problem-mcq",
    title: "MCQ QA fixture",
    slug: "mcq-qa-fixture",
    statement: "Chọn đáp án đúng.",
    instructions: "Chọn một đáp án A-D.",
    questionType: "MCQ",
    questions: positions.map((position, index) => ({
      ...base.questions[0],
      id: `question-mcq-${index}`,
      problemId: "problem-mcq",
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      prompt: `Câu hỏi ${index + 1} có nội dung đầy đủ.`,
      options: validOptions.map((option) => ({ ...option })),
      answer: { correctOptionId: position },
      explanation: completeExplanation,
      orderIndex: index,
      ...questionOverrides[index],
    })),
  };
}

function databaseProblems(problems: unknown[]) {
  return {
    problem: {
      findMany: vi.fn().mockResolvedValue(problems),
    },
    question: {
      findMany: vi.fn().mockResolvedValue(problems.flatMap((problem) =>
        ((problem as { questions?: unknown[] }).questions ?? []).map(
          narrowQuestion,
        ),
      )),
    },
  };
}

function identifiedMcqProblem(
  problemId: string,
  questionId: string,
  prompt: string,
  contentStatus = "NEEDS_REVIEW",
) {
  const problem = storedMcqProblem(["A"], [{ prompt }]);
  return {
    ...problem,
    id: problemId,
    slug: problemId,
    contentStatus,
    questions: problem.questions.map((question) => ({
      ...question,
      id: questionId,
      problemId,
      contentStatus,
    })),
  };
}

function databaseWithCorpus(problems: unknown[], corpus: unknown[]) {
  return {
    problem: {
      findMany: vi.fn().mockResolvedValue(problems),
    },
    question: {
      findMany: vi.fn().mockResolvedValue(corpus),
    },
  };
}

describe("persisted substantive exact-prompt review signal", () => {
  const duplicatePrompt = "Which option best completes this substantive sentence?";
  const activeCorpusQuery = {
    where: {
      contentStatus: { not: "ARCHIVED" },
      problem: { contentStatus: { not: "ARCHIVED" } },
    },
    select: {
      id: true,
      problemId: true,
      type: true,
      prompt: true,
    },
    orderBy: [{ problemId: "asc" }, { id: "asc" }],
  };

  it("warns both members of a duplicate within one targeted problem", async () => {
    const problem = storedMcqProblem(
      ["A", "B"],
      [{ prompt: duplicatePrompt }, { prompt: duplicatePrompt.toUpperCase() }],
    );
    const report = await getContentQaReport({}, database(problem) as never);
    const warnings = report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    );

    expect(warnings).toHaveLength(2);
    expect(warnings.map((warning) => warning.path)).toEqual([
      "questions.0.prompt",
      "questions.1.prompt",
    ]);
    expect(warnings.every((warning) =>
      warning.message.includes("với 1 câu hỏi đang hoạt động khác"),
    )).toBe(true);
  });

  it("warns both matched questions across two targeted problems", async () => {
    const first = identifiedMcqProblem(
      "problem-a",
      "question-a",
      duplicatePrompt,
    );
    const second = identifiedMcqProblem(
      "problem-b",
      "question-b",
      `  ${duplicatePrompt.toUpperCase()}  `,
    );
    const db = databaseWithCorpus(
      [first, second],
      [first.questions[0], second.questions[0]].map(narrowQuestion),
    );
    const report = await getContentQaReport({}, db as never);

    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    ).map((issue) => issue.entityId)).toEqual(["question-a", "question-b"]);
  });

  it("finds a problemIds match outside the target and serializes no comparison-only data", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const comparison = {
      id: "COMPARISON_QUESTION_ID_SENTINEL",
      problemId: "COMPARISON_PROBLEM_ID_SENTINEL",
      type: "OPEN_CLOZE",
      prompt: `\t${duplicatePrompt.toUpperCase()}\n`,
      problemTitle: "COMPARISON_PROBLEM_TITLE_SENTINEL",
      answer: "COMPARISON_ANSWER_SENTINEL",
      options: ["COMPARISON_OPTIONS_SENTINEL"],
      explanation: "COMPARISON_EXPLANATION_SENTINEL",
      metadata: { value: "COMPARISON_METADATA_SENTINEL" },
      provider: "COMPARISON_PROVIDER_SENTINEL",
      user: "COMPARISON_USER_SENTINEL",
    };
    const db = databaseWithCorpus(
      [target],
      [narrowQuestion(target.questions[0]), comparison],
    );
    const report = await getContentQaReport(
      { problemIds: ["problem-target"] },
      db as never,
    );
    const warnings = report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    );
    const serialized = JSON.stringify(report);

    expect(warnings).toEqual([expect.objectContaining({
      severity: "WARNING",
      entityType: "Question",
      entityId: "question-target",
      problemId: "problem-target",
      path: "questions.0.prompt",
      message: "Prompt này trùng sau chuẩn hóa với 1 câu hỏi đang hoạt động khác; cần biên tập viên rà soát.",
    })]);
    expect(report.problems.map((problem) => problem.problemId)).toEqual([
      "problem-target",
    ]);
    expect(db.problem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["problem-target"] } },
    }));
    expect(db.question.findMany).toHaveBeenCalledWith(activeCorpusQuery);
    for (const sentinel of [
      "COMPARISON_QUESTION_ID_SENTINEL",
      "COMPARISON_PROBLEM_ID_SENTINEL",
      "COMPARISON_PROBLEM_TITLE_SENTINEL",
      comparison.prompt,
      duplicatePrompt.toLocaleLowerCase("en"),
      "COMPARISON_ANSWER_SENTINEL",
      "COMPARISON_OPTIONS_SENTINEL",
      "COMPARISON_EXPLANATION_SENTINEL",
      "COMPARISON_METADATA_SENTINEL",
      "COMPARISON_PROVIDER_SENTINEL",
      "COMPARISON_USER_SENTINEL",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("finds a contentPackId match outside the target pack without emitting an outside issue", async () => {
    const target = identifiedMcqProblem(
      "problem-in-pack",
      "question-in-pack",
      duplicatePrompt,
    );
    const comparison = {
      id: "question-outside-pack",
      problemId: "problem-outside-pack",
      type: "MCQ",
      prompt: duplicatePrompt.toUpperCase(),
    };
    const db = databaseWithCorpus(
      [target],
      [narrowQuestion(target.questions[0]), comparison],
    );
    const report = await getContentQaReport(
      { contentPackId: "pack-target" },
      db as never,
    );
    const warnings = report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    );

    expect(warnings).toEqual([expect.objectContaining({
      entityId: "question-in-pack",
      problemId: "problem-in-pack",
    })]);
    expect(report.problems.map((problem) => problem.problemId)).toEqual([
      "problem-in-pack",
    ]);
    expect(db.problem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contentPackId: "pack-target" },
    }));
    expect(db.question.findMany).toHaveBeenCalledWith(activeCorpusQuery);
  });

  it("does not warn a target omitted from the canonical active corpus", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const comparisonOnly = {
      id: "question-comparison-only",
      problemId: "problem-comparison-only",
      type: "MCQ",
      prompt: duplicatePrompt,
    };
    const report = await getContentQaReport(
      {},
      databaseWithCorpus([target], [comparisonOnly]) as never,
    );

    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    )).toEqual([]);
  });

  it("warns two targets once each against a three-member active group", async () => {
    const first = identifiedMcqProblem(
      "problem-target-a",
      "question-target-a",
      duplicatePrompt,
    );
    const second = identifiedMcqProblem(
      "problem-target-b",
      "question-target-b",
      duplicatePrompt.toUpperCase(),
    );
    const comparisonOnly = {
      id: "question-comparison-only",
      problemId: "problem-comparison-only",
      type: "OPEN_CLOZE",
      prompt: `  ${duplicatePrompt}  `,
    };
    const report = await getContentQaReport(
      {},
      databaseWithCorpus(
        [first, second],
        [
          narrowQuestion(first.questions[0]),
          narrowQuestion(second.questions[0]),
          comparisonOnly,
        ],
      ) as never,
    );
    const warnings = report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    );

    expect(warnings.map((warning) => warning.entityId)).toEqual([
      "question-target-a",
      "question-target-b",
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) =>
      warning.message.includes("với 2 câu hỏi đang hoạt động khác"),
    )).toBe(true);
    expect(warnings.some((warning) =>
      warning.entityId === "question-comparison-only",
    )).toBe(false);
  });

  it("emits one warning per targeted member of a three-question group", async () => {
    const targets = ["c", "a", "b"].map((suffix, index) =>
      identifiedMcqProblem(
        `problem-${suffix}`,
        `question-${suffix}`,
        index === 0 ? duplicatePrompt : duplicatePrompt.toUpperCase(),
      ),
    );
    const report = await getContentQaReport(
      {},
      databaseWithCorpus(
        targets,
        targets.map((problem) => narrowQuestion(problem.questions[0])),
      ) as never,
    );
    const warnings = report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    );

    expect(warnings).toHaveLength(3);
    expect(warnings.every((warning) =>
      warning.message.includes("với 2 câu hỏi đang hoạt động khác"),
    )).toBe(true);
    expect(new Set(warnings.map((warning) => warning.entityId)).size).toBe(3);
  });

  it.each([
    ["archived question", "ARCHIVED", "PUBLISHED"],
    ["question under archived problem", "PUBLISHED", "ARCHIVED"],
  ])("excludes an %s from the comparison corpus", async (
    _label,
    questionStatus,
    problemStatus,
  ) => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const storedRows = [
      {
        ...narrowQuestion(target.questions[0]),
        contentStatus: "PUBLISHED",
        problemContentStatus: "PUBLISHED",
      },
      {
        id: "question-archived",
        problemId: "problem-archived",
        type: "MCQ",
        prompt: duplicatePrompt,
        contentStatus: questionStatus,
        problemContentStatus: problemStatus,
      },
    ];
    const db = {
      problem: { findMany: vi.fn().mockResolvedValue([target]) },
      question: {
        findMany: vi.fn().mockImplementation(async (query) => {
          expect(query.where).toEqual({
            contentStatus: { not: "ARCHIVED" },
            problem: { contentStatus: { not: "ARCHIVED" } },
          });
          return storedRows
            .filter((row) =>
              row.contentStatus !== "ARCHIVED" &&
              row.problemContentStatus !== "ARCHIVED",
            )
            .map(narrowQuestion);
        }),
      },
    };
    const report = await getContentQaReport({}, db as never);

    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    )).toEqual([]);
  });

  it.each(["DRAFT", "NEEDS_REVIEW", "PUBLISHED"])(
    "includes active %s comparison rows",
    async (contentStatus) => {
      const target = identifiedMcqProblem(
        "problem-target",
        "question-target",
        duplicatePrompt,
      );
      const comparison = identifiedMcqProblem(
        `problem-${contentStatus}`,
        `question-${contentStatus}`,
        duplicatePrompt,
        contentStatus,
      );
      const report = await getContentQaReport(
        {},
        databaseWithCorpus(
          [target],
          [target.questions[0], comparison.questions[0]].map(narrowQuestion),
        ) as never,
      );

      expect(report.issues.filter(
        (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
      )).toHaveLength(1);
    },
  );

  it("excludes generic, short, punctuation-different, and diacritic-different prompts", async () => {
    const base = storedMcqProblem(
      ["A", "B", "C", "D", "A", "B", "C", "D"],
      [
        { type: "PRONUNCIATION_ODD_ONE_OUT", prompt: duplicatePrompt },
        { type: "PRONUNCIATION_ODD_ONE_OUT", prompt: duplicatePrompt },
        { type: "TRIOS_GAPPED_SENTENCES", prompt: duplicatePrompt },
        { type: "TRIOS_GAPPED_SENTENCES", prompt: duplicatePrompt },
        { prompt: "x".repeat(19) },
        { prompt: "x".repeat(19) },
        { prompt: "Is résumé punctuation retained here?" },
        { prompt: "Is resume punctuation retained here!" },
      ],
    );
    const report = await getContentQaReport(
      {},
      databaseWithCorpus(
        [base],
        base.questions.map(narrowQuestion),
      ) as never,
    );

    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    )).toEqual([]);
  });

  it("ignores a self-only corpus row and repeated copies of the same ID", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const row = narrowQuestion(target.questions[0]);
    const report = await getContentQaReport(
      {},
      databaseWithCorpus([target], [row, { ...row }]) as never,
    );

    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    )).toEqual([]);
  });

  it("skips the corpus query when the target query returns no problems", async () => {
    const db = databaseWithCorpus([], []);
    const report = await getContentQaReport({}, db as never);

    expect(report.summary.problemsChecked).toBe(0);
    expect(db.problem.findMany).toHaveBeenCalledTimes(1);
    expect(db.question.findMany).not.toHaveBeenCalled();
  });

  it("uses one exact narrow ordered corpus query on the injected client", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const db = databaseWithCorpus([target], [narrowQuestion(target.questions[0])]);

    await getContentQaReport({}, db as never);

    expect(db.problem.findMany).toHaveBeenCalledTimes(1);
    expect(db.problem.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        sourceCollection: true,
        problemTopics: { include: { topic: true } },
        questions: {
          orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    expect(db.question.findMany).toHaveBeenCalledTimes(1);
    expect(db.question.findMany).toHaveBeenCalledWith(activeCorpusQuery);
    const serializedQuery = JSON.stringify(db.question.findMany.mock.calls);
    for (const forbiddenField of [
      "answer",
      "options",
      "explanation",
      "metadata",
      "passage",
      "provider",
      "submission",
      "user",
      "include",
      "take",
    ]) {
      expect(serializedQuery).not.toContain(forbiddenField);
    }
  });

  it("keeps equal-timestamp problem and equal-orderIndex question issue order deterministic", async () => {
    const firstBase = storedMcqProblem(
      ["A", "B"],
      [{ prompt: duplicatePrompt }, { prompt: duplicatePrompt.toUpperCase() }],
    );
    const tiedUpdatedAt = new Date("2026-02-01T00:00:00.000Z");
    const first = {
      ...firstBase,
      id: "problem-a",
      slug: "problem-a",
      updatedAt: tiedUpdatedAt,
      questions: firstBase.questions.map((question, index) => ({
        ...question,
        id: index === 0 ? "question-a-z" : "question-a-a",
        problemId: "problem-a",
        orderIndex: 0,
      })),
    };
    const second = {
      ...identifiedMcqProblem(
        "problem-b",
        "question-b",
        duplicatePrompt,
      ),
      updatedAt: tiedUpdatedAt,
    };
    const storedProblems = [second, first];
    const db = {
      problem: {
        findMany: vi.fn().mockImplementation(async (query: unknown) => {
          expect(query).toEqual({
            where: {},
            include: {
              sourceCollection: true,
              problemTopics: { include: { topic: true } },
              questions: {
                orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          });
          return [...storedProblems]
            .sort((left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime() ||
              left.id.localeCompare(right.id),
            )
            .map((problem) => ({
              ...problem,
              questions: [...problem.questions].sort((left, right) =>
                left.orderIndex - right.orderIndex ||
                left.id.localeCompare(right.id),
              ),
            }));
        }),
      },
      question: {
        findMany: vi.fn().mockResolvedValue([
          ...first.questions.map(narrowQuestion),
          narrowQuestion(second.questions[0]),
        ]),
      },
    };
    const report = await getContentQaReport({}, db as never);

    expect(report.problems.map((problem) => problem.problemId)).toEqual([
      "problem-a",
      "problem-b",
    ]);
    expect(report.issues.filter(
      (issue) => issue.code === "DUPLICATE_PROMPT_EXACT",
    ).map((issue) => issue.entityId)).toEqual([
      "question-a-a",
      "question-a-z",
      "question-b",
    ]);
  });

  it("fails closed when the active corpus query rejects", async () => {
    const rawCorpusSentinel = "RAW_CORPUS_VALUE_MUST_NOT_ESCAPE";
    const corpusFailure = new Error("Synthetic active corpus query failure.");
    const mutationExecutor = vi.fn();
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const db = {
      problem: {
        findMany: vi.fn().mockResolvedValue([target]),
        updateMany: mutationExecutor,
      },
      question: {
        findMany: vi.fn().mockRejectedValue(corpusFailure),
      },
    };

    await expect(getContentQaReport({}, db as never)).rejects.toBe(corpusFailure);
    let publishableIds: string[] | undefined;
    let selectionError: unknown;
    try {
      publishableIds = await getPublishableProblemIds(
        [target.id],
        db as never,
      );
    } catch (error) {
      selectionError = error;
    }

    expect(selectionError).toBe(corpusFailure);
    expect(publishableIds).toBeUndefined();
    expect(db.question.findMany).toHaveBeenCalledTimes(2);
    expect(mutationExecutor).not.toHaveBeenCalled();
    expect(corpusFailure.message).not.toContain(rawCorpusSentinel);
  });

  it("keeps duplicate-warning-only QA publishable and returned by the helper", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const corpus = [
      narrowQuestion(target.questions[0]),
      {
        id: "question-comparison",
        problemId: "problem-comparison",
        type: "MCQ",
        prompt: duplicatePrompt,
      },
    ];
    const report = await getContentQaReport(
      {},
      databaseWithCorpus([target], corpus) as never,
    );
    const publishableIds = await getPublishableProblemIds(
      [target.id],
      databaseWithCorpus([target], corpus) as never,
    );

    expect(report.problems[0]).toMatchObject({
      errors: 0,
      warnings: 1,
      canPublish: true,
    });
    expect(publishableIds).toEqual(["problem-target"]);
  });

  it("keeps the existing possible-import-duplicate error blocking alongside the warning", async () => {
    const target = identifiedMcqProblem(
      "problem-target",
      "question-target",
      duplicatePrompt,
    );
    const targetWithDuplicateRisk = {
      ...target,
      questions: target.questions.map((question) => ({
        ...question,
        metadata: { duplicateRisk: { level: "POSSIBLE" } },
      })),
    };
    const corpus = [
      narrowQuestion(targetWithDuplicateRisk.questions[0]),
      {
        id: "question-comparison",
        problemId: "problem-comparison",
        type: "MCQ",
        prompt: duplicatePrompt,
      },
    ];
    const report = await getContentQaReport(
      {},
      databaseWithCorpus([targetWithDuplicateRisk], corpus) as never,
    );
    const publishableIds = await getPublishableProblemIds(
      [targetWithDuplicateRisk.id],
      databaseWithCorpus([targetWithDuplicateRisk], corpus) as never,
    );

    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "DUPLICATE_POSSIBLE",
      severity: "ERROR",
    }));
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: "DUPLICATE_PROMPT_EXACT",
      severity: "WARNING",
    }));
    expect(report.problems[0]).toMatchObject({ errors: 1, canPublish: false });
    expect(publishableIds).toEqual([]);
  });
});

describe("persisted explanation-depth review signal", () => {
  it.each([
    ["missing", null],
    ["whitespace-only", "   "],
  ])("emits only the existing missing warning for %s explanation", async (_label, explanation) => {
    const report = await getContentQaReport(
      {},
      database(storedMcqProblem(["A"], [{ explanation }])) as never,
    );
    const explanationIssues = report.issues.filter(
      (issue) => issue.path === "questions.0.explanation",
    );

    expect(explanationIssues).toHaveLength(1);
    expect(explanationIssues[0]).toMatchObject({
      severity: "WARNING",
      entityType: "Question",
      entityId: "question-mcq-0",
    });
    expect(explanationIssues[0]?.code).toBeUndefined();
  });

  it.each([
    ["one code unit", "x", true],
    ["44 code units", "x".repeat(44), true],
    ["45 code units", "x".repeat(45), false],
    ["more than 45 code units", "x".repeat(46), false],
    ["trimmed 44 code units", `  ${"x".repeat(44)}  `, true],
    ["trimmed 45 code units", `  ${"x".repeat(45)}  `, false],
  ])("classifies %s at persisted QA", async (_label, explanation, expected) => {
    const problem = storedMcqProblem(["A"], [{ explanation }]);
    const before = problem.questions[0]?.explanation;
    const report = await getContentQaReport(
      {},
      database(problem) as never,
    );
    const shortIssues = report.issues.filter(
      (issue) => issue.code === "EXPLANATION_TOO_SHORT",
    );

    expect(shortIssues).toHaveLength(expected ? 1 : 0);
    if (expected) {
      expect(shortIssues[0]).toMatchObject({
        severity: "WARNING",
        entityType: "Question",
        entityId: "question-mcq-0",
        path: "questions.0.explanation",
      });
    }
    expect(problem.questions[0]?.explanation).toBe(before);
  });
});

describe("persisted answer-position review signal", () => {
  it.each([
    ["A,A,A,B", ["A", "A", "A", "B"], 1],
    ["A,A,B,B", ["A", "A", "B", "B"], 0],
    ["A,B,C,D", ["A", "B", "C", "D"], 0],
    ["A,A,A", ["A", "A", "A"], 0],
    ["eight with D absent", ["A", "A", "B", "B", "B", "C", "C", "C"], 1],
  ])("emits the expected warning for %s", async (_label, positions, expectedWarnings) => {
    const report = await getContentQaReport(
      {},
      database(storedMcqProblem(positions)) as never,
    );

    expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
      .toHaveLength(expectedWarnings);
  });

  it.each([
    ["invalid option count", { options: validOptions.slice(0, 3) }],
    [
      "duplicate option IDs",
      { options: [validOptions[0], { ...validOptions[1], id: "A" }, validOptions[2], validOptions[3]] },
    ],
    ["answer outside options", { answer: { correctOptionId: "Z" } }],
  ])("excludes %s from the eligible sample", async (_label, invalidOverride) => {
    const report = await getContentQaReport(
      {},
      database(storedMcqProblem(
        ["A", "A", "A", "A"],
        [{}, {}, {}, invalidOverride],
      )) as never,
    );

    expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
      .toEqual([]);
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", " \t "],
  ])("rejects %s option text and excludes that question", async (_label, text) => {
    const invalidOptions = validOptions.map((option) => ({ ...option }));
    invalidOptions[1] = { ...invalidOptions[1], text };
    const problem = storedMcqProblem(
      ["A", "A", "A", "B"],
      [{}, {}, {}, { options: invalidOptions }],
    );

    const report = await getContentQaReport({}, database(problem) as never);
    const invalidQuestionIssues = report.issues.filter(
      (issue) => issue.entityId === "question-mcq-3",
    );

    expect(invalidQuestionIssues).toContainEqual(expect.objectContaining({
      severity: "ERROR",
      entityType: "Question",
      path: "questions.3.options",
    }));
    expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
      .toEqual([]);
  });

  it.each(["id", "text"] as const)(
    "does not invoke an option %s getter in production QA",
    async (key) => {
      let getterCalls = 0;
      const option: Record<string, unknown> = key === "id"
        ? { text: "The students" }
        : { id: "A" };
      Object.defineProperty(option, key, {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error(`${key} getter must not run`);
        },
      });
      const descriptor = Object.getOwnPropertyDescriptor(option, key);
      const hostileOptions = [option, ...validOptions.slice(1).map((item) => ({ ...item }))];
      const problem = storedMcqProblem(
        ["A", "A", "A", "B"],
        [{}, {}, {}, { options: hostileOptions }],
      );

      const report = await getContentQaReport({}, database(problem) as never);

      expect(getterCalls).toBe(0);
      expect(report.issues).toContainEqual(expect.objectContaining({
        severity: "ERROR",
        entityId: "question-mcq-3",
        path: "questions.3.options",
      }));
      expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
        .toEqual([]);
      expect(Object.getOwnPropertyDescriptor(option, key)).toEqual(descriptor);
      expect(problem.questions[3]?.options).toBe(hostileOptions);
    },
  );

  it("does not invoke a correctOptionId getter in production QA", async () => {
    let getterCalls = 0;
    const answer = Object.defineProperty({}, "correctOptionId", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error("correctOptionId getter must not run");
      },
    });
    const descriptor = Object.getOwnPropertyDescriptor(answer, "correctOptionId");
    const problem = storedMcqProblem(
      ["A", "A", "A", "B"],
      [{}, {}, {}, { answer }],
    );

    const report = await getContentQaReport({}, database(problem) as never);

    expect(getterCalls).toBe(0);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: "ERROR",
      entityId: "question-mcq-3",
      path: "questions.3.answer",
    }));
    expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
      .toEqual([]);
    expect(Object.getOwnPropertyDescriptor(answer, "correctOptionId")).toEqual(
      descriptor,
    );
    expect(problem.questions[3]?.answer).toBe(answer);
  });

  it.each(["id", "text"] as const)(
    "rejects an inherited option %s in production QA",
    async (key) => {
      const inheritedValue = key === "id" ? "A" : "The students";
      const option = Object.create({ [key]: inheritedValue }) as Record<
        string,
        unknown
      >;
      option[key === "id" ? "text" : "id"] = key === "id"
        ? "The students"
        : "A";
      const prototype = Object.getPrototypeOf(option);
      const problem = storedMcqProblem(
        ["A", "A", "A", "B"],
        [{}, {}, {}, { options: [option, ...validOptions.slice(1)] }],
      );

      const report = await getContentQaReport({}, database(problem) as never);

      expect(report.issues).toContainEqual(expect.objectContaining({
        severity: "ERROR",
        entityId: "question-mcq-3",
        path: "questions.3.options",
      }));
      expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
        .toEqual([]);
      expect(Object.getPrototypeOf(option)).toBe(prototype);
    },
  );

  it("rejects an inherited correctOptionId in production QA", async () => {
    const answer = Object.create({ correctOptionId: "B" }) as Record<
      string,
      unknown
    >;
    const prototype = Object.getPrototypeOf(answer);
    const problem = storedMcqProblem(
      ["A", "A", "A", "B"],
      [{}, {}, {}, { answer }],
    );

    const report = await getContentQaReport({}, database(problem) as never);

    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: "ERROR",
      entityId: "question-mcq-3",
      path: "questions.3.answer",
    }));
    expect(report.issues.filter((issue) => issue.code === "ANSWER_POSITION_SKEW"))
      .toEqual([]);
    expect(Object.getPrototypeOf(answer)).toBe(prototype);
  });

  it("keeps a hostile question from contaminating valid distribution counts", async () => {
    let getterCalls = 0;
    const hostileOption = Object.defineProperty(
      { text: "The students" },
      "id",
      {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          throw new Error("hostile getter must not run");
        },
      },
    );
    const problem = storedMcqProblem(
      ["A", "A", "A", "B", "B"],
      [
        {},
        {},
        {},
        {},
        { options: [hostileOption, ...validOptions.slice(1)] },
      ],
    );

    const report = await getContentQaReport({}, database(problem) as never);
    const skewIssues = report.issues.filter(
      (issue) => issue.code === "ANSWER_POSITION_SKEW",
    );

    expect(getterCalls).toBe(0);
    expect(skewIssues).toHaveLength(1);
    expect(skewIssues[0]?.message).toContain("A=3, B=1, C=0, D=0");
  });

  it("excludes unsupported types and handles a mixed sample deterministically", async () => {
    const problem = storedMcqProblem(
      ["A", "A", "A", "B", "A", "A"],
      [
        {},
        {},
        {},
        {},
        {
          type: "OPEN_CLOZE",
          options: null,
          answer: { acceptedAnswers: ["answer"] },
        },
        { answer: { correctOptionId: "Z" } },
      ],
    );
    const report = await getContentQaReport({}, database(problem) as never);
    const skewIssues = report.issues.filter(
      (issue) => issue.code === "ANSWER_POSITION_SKEW",
    );

    expect(skewIssues).toHaveLength(1);
    expect(skewIssues[0]).toMatchObject({
      severity: "WARNING",
      entityType: "Problem",
      entityId: "problem-mcq",
      path: "questions.answerPositionDistribution",
      message: "Tín hiệu rà soát phân bố vị trí đáp án: A=3, B=1, C=0, D=0.",
    });
  });

  it("emits at most one bounded warning without answer-key mappings", async () => {
    const problem = storedMcqProblem(
      ["A", "A", "A", "A", "A", "A", "B", "C"],
      Array.from({ length: 8 }, (_, index) => ({
        id: `QUESTION_MAPPING_SENTINEL_${index}`,
        answer: {
          correctOptionId: index < 6 ? "A" : index === 6 ? "B" : "C",
          secret: "RAW_ANSWER_SENTINEL",
        },
      })),
    );
    const report = await getContentQaReport({}, database(problem) as never);
    const skewIssues = report.issues.filter(
      (issue) => issue.code === "ANSWER_POSITION_SKEW",
    );
    const serialized = JSON.stringify(skewIssues);

    expect(skewIssues).toHaveLength(1);
    expect(skewIssues[0]?.message).toContain("A=6, B=1, C=1, D=0");
    expect(serialized).not.toContain("QUESTION_MAPPING_SENTINEL");
    expect(serialized).not.toContain("RAW_ANSWER_SENTINEL");
    expect(serialized).not.toContain("correctOptionId");
  });
});

describe("QA warning publication semantics", () => {
  it("keeps a warning-only problem publishable and included in publishable IDs", async () => {
    const problem = storedMcqProblem(["A", "A", "A", "B"]);
    const db = database(problem);
    const report = await getContentQaReport({}, db as never);
    const publishableIds = await getPublishableProblemIds(
      [problem.id],
      database(problem) as never,
    );

    expect(report.summary).toMatchObject({
      problemsChecked: 1,
      publishableProblems: 1,
      errors: 0,
      warnings: 1,
    });
    expect(report.problems[0]).toMatchObject({
      problemId: "problem-mcq",
      errors: 0,
      warnings: 1,
      canPublish: true,
    });
    expect(publishableIds).toEqual(["problem-mcq"]);
  });

  it("keeps existing blocking errors authoritative", async () => {
    const problem = storedMcqProblem(
      ["A", "A", "A", "B"],
      [{ prompt: "", passage: null }],
    );
    const report = await getContentQaReport({}, database(problem) as never);
    const publishableIds = await getPublishableProblemIds(
      [problem.id],
      database(problem) as never,
    );

    expect(report.problems[0]).toMatchObject({
      errors: 1,
      canPublish: false,
    });
    expect(publishableIds).toEqual([]);
  });

  it("totals independent explanation and distribution warnings", async () => {
    const shortProblem = storedMcqProblem(["A"], [{ explanation: "x" }]);
    const skewProblem = {
      ...storedMcqProblem(["A", "A", "A", "B"]),
      id: "problem-skew",
      slug: "problem-skew",
      questions: storedMcqProblem(["A", "A", "A", "B"]).questions.map(
        (question, index) => ({
          ...question,
          id: `question-skew-${index}`,
          problemId: "problem-skew",
          prompt: `${question.prompt} cho problem skew.`,
        }),
      ),
    };
    const report = await getContentQaReport(
      {},
      databaseProblems([shortProblem, skewProblem]) as never,
    );

    expect(report.summary).toMatchObject({
      problemsChecked: 2,
      publishableProblems: 2,
      errors: 0,
      warnings: 2,
    });
  });
});
