import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { PronunciationQuestion } from "@/components/questions/PronunciationQuestion";
import { questionPublishErrors, validateQuestionEditPayload } from "@/lib/admin/questions";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import { getContentQaReport } from "@/lib/content-packs/qa";
import { toAdminProblemPreviewDTO } from "@/lib/dto/admin-problem-preview";
import {
  toLearnerQuestionDTO,
  type LearnerQuestionSource,
} from "@/lib/dto/learner-question";
import { normalizeJsonText } from "@/lib/import/normalize-file";
import { enforceImportPublicationContract } from "@/lib/import/publication-validation";
import type { ImportPlan, NormalizedImportPayload } from "@/lib/import/types";
import type { ClientQuestion } from "@/lib/problem-types";
import {
  pronunciationCodePoints,
  slicePronunciationText,
  validatePronunciationContract,
} from "@/lib/questions/pronunciation-contract";

const PACK_PATH = path.join(
  process.cwd(),
  "content-packs/pilot-pack-001/01-pronunciation-pack-001.json",
);

// PR16-retained rows that remained untouched by PR17 replacements. They keep
// the original PR16 spans and answer positions. PR17 only re-authored the
// ten historical blockers below; the 20 PR16-repaired rows are value-
// identical to canonical base 9702593.
const PR16_RETAINED_NUMBERS = new Set<number>([
  1, 4, 5, 6, 8, 9, 12, 13, 15, 16,
  18, 19, 22, 23, 24, 25, 26, 27, 28, 30,
]);

// Ten historical PR16 blockers that PR17 has replaced with newly authored
// items. They are no longer fail-closed.
const PR17_REPLACEMENT_NUMBERS = new Set<number>([
  2, 3, 7, 10, 11, 14, 17, 20, 21, 29,
]);

const PR16_RETAINED_SHA256 = new Map<number, string>([
  [1, "01adbb376faed7ab36c9db6095a1478106ca36a0a4e76db2b2c4627babf8780e"],
  [4, "f581df21f62c6fb5febd4e88ab37830d8e9b692598e3448b94842cbbc8c85cf4"],
  [5, "ad92e8b4f410c932dd25a14ab4339e3379f439c14afa3a9628eb39344dd32f50"],
  [6, "eb98d43e813d9874893293e111b47b29278557971be2adb067ddd797e86e9cfb"],
  [8, "6428026ab1c68668a7bdc735d7cf55d99571ac39e9a7805e1183a1b6ba47c462"],
  [9, "4345585282eef609a60ffeb547ddbb3ebd5a124d2163c4858b993ba56da40a1a"],
  [12, "c518eea9ac2096246a240b8e6c5492fdbfff3ea763bdb4617801655b1d19c60a"],
  [13, "0c20c9b3dc56b4e126eaf16cc699d0df9c015d31e1de7c4a8354cac4afcbbb0f"],
  [15, "60d1745d698b3c4f213cf307f0465d80e05cfd19ed3b73fb8c61452afe32af6a"],
  [16, "9bae5d98d05372b07b6c4724efc03c78aecc0e347b32c93199adc73bf652fc51"],
  [18, "61df8b0723b8e5add82a5145d2f56406a5db5990283f70b4a9db6272dffc1510"],
  [19, "b87fffb14d125e0dadd1cd9ac5fc1772964d16aa8e1a39970a07cad5b74373f0"],
  [22, "898be67df1c37f7ac115bd711556fa3a2e52e8f07bda4fb5d9c5387e7cc2b289"],
  [23, "a24d5b1267db2e7705a5bfe1925dba8cd3dc21b251cbb7b527b6cc7528fe56a6"],
  [24, "63cc489e13b5f6b59c4ebebb51ccf2fba2748c53a5d53bcca01f8a86cdcb9a74"],
  [25, "b9888d74946e3a83d5a2312a9d6e535a6d9d25839843411dbc47c35618c45611"],
  [26, "8e0bee6865baf7bd292336f0466e6a807cbc7c9b0b1fe452f15475c3aa76b8ca"],
  [27, "58a51f4df8c599b9f88c317b938a3c307e32eae871a10908f423b976b1718e00"],
  [28, "6f312982e884265ef88c5ea21714585bc609b905288b62fab2768f5f6145a73e"],
  [30, "958a457a500c4e8782d6280c3fd7d8e94b44466e17be4d2f80b02753f5f77bad"],
]);

const PR17_EXPECTED_REPLACEMENTS = new Map<number, {
  options: readonly (readonly [string, number, number])[];
  answer: string;
}>([
  [2, { options: [["what", 0, 2], ["when", 0, 2], ["where", 0, 2], ["whole", 0, 2]], answer: "D" }],
  [3, { options: [["gem", 0, 1], ["gentle", 0, 1], ["give", 0, 1], ["giant", 0, 1]], answer: "C" }],
  [7, { options: [["chrome", 0, 2], ["church", 0, 2], ["chemist", 0, 2], ["school", 1, 3]], answer: "B" }],
  [10, { options: [["action", 2, 6], ["question", 4, 8], ["motion", 2, 6], ["nation", 2, 6]], answer: "B" }],
  [11, { options: [["knife", 0, 1], ["kite", 0, 1], ["knee", 0, 1], ["knob", 0, 1]], answer: "B" }],
  [14, { options: [["think", 0, 2], ["thank", 0, 2], ["this", 0, 2], ["three", 0, 2]], answer: "C" }],
  [17, { options: [["long", 2, 4], ["ring", 2, 4], ["singe", 2, 4], ["sing", 2, 4]], answer: "C" }],
  [20, { options: [["center", 0, 1], ["cat", 0, 1], ["cinema", 0, 1], ["circle", 0, 1]], answer: "B" }],
  [21, { options: [["word", 1, 3], ["story", 2, 4], ["work", 1, 3], ["world", 1, 3]], answer: "B" }],
  [29, { options: [["wrap", 0, 1], ["wrath", 0, 1], ["wave", 0, 1], ["wreck", 0, 1]], answer: "C" }],
] as const);

const EXPECTED_TARGETS = new Map<number, readonly string[]>([
  // PR16-repaired rows (unchanged).
  [1, ["ea", "ea", "ea", "ee"]],
  [4, ["ed", "ed", "ed", "ed"]],
  [5, ["s", "s", "ss", "s"]],
  [6, ["ch", "ch", "ch", "ch"]],
  [8, ["w", "w", "w", "w"]],
  [9, ["s", "s", "s", "ss"]],
  [12, ["b", "b", "b", "b"]],
  [13, ["eigh", "eigh", "eigh", "eigh"]],
  [15, ["gh", "gh", "gh", "gh"]],
  [16, ["g", "g", "g", "g"]],
  [18, ["ai", "ai", "ai", "ai"]],
  [19, ["h", "h", "h", "h"]],
  [22, ["gh", "gh", "gh", "gh"]],
  [23, ["v", "gh", "f", "f"]],
  [24, ["ch", "ch", "ch", "ch"]],
  [25, ["ed", "ed", "ed", "ed"]],
  [26, ["z", "s", "s", "s"]],
  [27, ["qu", "qu", "qu", "qu"]],
  [28, ["b", "b", "b", "b"]],
  [30, ["s", "s", "s", "s"]],
  // PR17 replacement rows (newly authored).
  [2, ["wh", "wh", "wh", "wh"]],
  [3, ["g", "g", "g", "g"]],
  [7, ["ch", "ch", "ch", "ch"]],
  [10, ["tion", "tion", "tion", "tion"]],
  [11, ["k", "k", "k", "k"]],
  [14, ["th", "th", "th", "th"]],
  [17, ["ng", "ng", "ng", "ng"]],
  [20, ["c", "c", "c", "c"]],
  [21, ["or", "or", "or", "or"]],
  [29, ["w", "w", "w", "w"]],
]);

const SHORT_EXPLANATION_MIN_LENGTH = 45;

type RawQuestion = {
  type: "PRONUNCIATION_ODD_ONE_OUT";
  skillType: "PRONUNCIATION";
  difficulty: "CHUYEN";
  prompt: string;
  passage: string | null;
  options: unknown;
  answer: unknown;
  explanation: string | null;
  rootWord: string | null;
  keyword: string | null;
  targetSentence: string | null;
  lineNumber: number | null;
  metadata: { focus: string; questionNumber: number };
};

type RawProblem = {
  title: string;
  slug: string;
  skillType: "PRONUNCIATION";
  questionType: "PRONUNCIATION_ODD_ONE_OUT";
  difficulty: "CHUYEN";
  statement: string;
  instructions: string;
  estimatedMinutes: number;
  topics: string[];
  questions: RawQuestion[];
};

type RawPack = {
  sourceCollection: {
    name: string;
    description: string;
    originalFileName: string;
    sourceType: string;
    copyrightNote: string;
  };
  problems: RawProblem[];
};

type IndexedQuestion = {
  globalNumber: number;
  localNumber: number;
  problem: RawProblem;
  question: RawQuestion;
};

function readPack() {
  const raw = fs.readFileSync(PACK_PATH, "utf8");
  return { raw, pack: JSON.parse(raw) as RawPack };
}

function indexedQuestions(pack: RawPack): IndexedQuestion[] {
  let globalNumber = 0;
  return pack.problems.flatMap((problem) =>
    problem.questions.map((question, localIndex) => ({
      globalNumber: ++globalNumber,
      localNumber: localIndex + 1,
      problem,
      question,
    })),
  );
}

function learnerSource(indexed: IndexedQuestion) {
  const { question, problem, globalNumber, localNumber } = indexed;
  return {
    ...question,
    id: `pilot-pronunciation-q${globalNumber}`,
    orderIndex: localNumber - 1,
    problem: { title: problem.title },
  } satisfies LearnerQuestionSource & Record<string, unknown>;
}

function clientQuestion(indexed: IndexedQuestion): ClientQuestion {
  return toLearnerQuestionDTO(learnerSource(indexed));
}

function importPlan(
  payload: NormalizedImportPayload,
  issues: ImportPlan["issues"],
): ImportPlan {
  const errors = issues.filter((issue) => issue.level === "error").length;
  const warnings = issues.filter((issue) => issue.level === "warning").length;
  return {
    ok: errors === 0,
    importType: payload.importType,
    payload,
    issues,
    preview: [],
    summary: {
      sourceCollectionsToCreate: 1,
      sourceCollectionsReused: 0,
      topicsToCreate: 0,
      topicsReused: 0,
      problemsToCreate: payload.problems.length,
      questionsToCreate: payload.problems.reduce(
        (total, problem) => total + problem.questions.length,
        0,
      ),
      duplicateProblemsSkipped: 0,
      duplicateQuestionsSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      problemsImported: 0,
      questionsImported: 0,
      errors,
      warnings,
    },
  };
}

function storedProblems(pack: RawPack) {
  const timestamp = new Date("2026-08-02T00:00:00.000Z");
  let globalNumber = 0;
  return pack.problems.map((problem, problemIndex) => {
    const problemId = `pilot-pronunciation-problem-${problemIndex + 1}`;
    return {
      id: problemId,
      title: problem.title,
      slug: problem.slug,
      skillType: problem.skillType,
      questionType: problem.questionType,
      difficulty: problem.difficulty,
      contentStatus: "NEEDS_REVIEW",
      statement: problem.statement,
      instructions: problem.instructions,
      estimatedMinutes: problem.estimatedMinutes,
      sourceCollection: { id: "pilot-pronunciation-source", name: "Pilot" },
      problemTopics: [{ topic: { id: "pronunciation", name: "Pronunciation", slug: "pronunciation" } }],
      updatedAt: timestamp,
      questions: problem.questions.map((question, questionIndex) => {
        globalNumber += 1;
        return {
          ...question,
          id: `pilot-pronunciation-q${globalNumber}`,
          problemId,
          contentStatus: "NEEDS_REVIEW",
          reviewedAt: null,
          reviewedById: null,
          orderIndex: questionIndex,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      }),
    };
  });
}

function assertNoDuplicateJsonKeys(raw: string) {
  const source = ts.createSourceFile(
    "pronunciation-pack.ts",
    `const pronunciationPack = ${raw};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const duplicates: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      node.properties.forEach((property) => {
        if (!ts.isPropertyAssignment(property)) return;
        const key = ts.isStringLiteral(property.name)
          ? property.name.text
          : property.name.getText(source);
        if (keys.has(key)) duplicates.push(key);
        keys.add(key);
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(duplicates).toEqual([]);
}

describe("Pronunciation pilot pack 001 PR17 replacement content", () => {
  it("keeps one duplicate-key-free 6-problem, 30-question Q1-Q30 inventory", () => {
    const { raw, pack } = readPack();
    const questions = indexedQuestions(pack);

    assertNoDuplicateJsonKeys(raw);
    expect(pack.problems).toHaveLength(6);
    expect(pack.problems.every((problem) => problem.questions.length === 5)).toBe(true);
    expect(questions).toHaveLength(30);
    expect(questions.map(({ globalNumber, localNumber, question }) => ({
      globalNumber,
      localNumber,
      authoredNumber: question.metadata.questionNumber,
    }))).toEqual(Array.from({ length: 30 }, (_, index) => ({
      globalNumber: index + 1,
      localNumber: (index % 5) + 1,
      authoredNumber: index + 1,
    })));
  });

  it("validates every row, slices exactly the reviewed code-point target, and only uses the canonical id/text/targetSpan fields", () => {
    const questions = indexedQuestions(readPack().pack);

    expect(questions).toHaveLength(30);
    questions.forEach(({ globalNumber, question }) => {
      const contract = validatePronunciationContract(question.options, question.answer);
      expect(contract.valid, `Q${globalNumber}`).toBe(true);
      expect(contract.options.map((option) => option.id), `Q${globalNumber}`).toEqual(["A", "B", "C", "D"]);
      expect(contract.options.map((option) => Object.keys(option)), `Q${globalNumber}`).toEqual([
        ["id", "text", "targetSpan"],
        ["id", "text", "targetSpan"],
        ["id", "text", "targetSpan"],
        ["id", "text", "targetSpan"],
      ]);
      expect(contract.options.map((option) =>
        slicePronunciationText(option.text, option.targetSpan).target
      ), `Q${globalNumber}`).toEqual(EXPECTED_TARGETS.get(globalNumber));
      contract.options.forEach((option) => {
        expect(Object.hasOwn(option, "id")).toBe(true);
        expect(Object.hasOwn(option, "text")).toBe(true);
        expect(Object.hasOwn(option, "targetSpan")).toBe(true);
        const codePoints = pronunciationCodePoints(option.text);
        expect(option.targetSpan.start).toBeGreaterThanOrEqual(0);
        expect(option.targetSpan.start).toBeLessThan(option.targetSpan.end);
        expect(option.targetSpan.end).toBeLessThanOrEqual(codePoints.length);
        // No whole-word span: a single-character target is fine but a span
        // that covers the entire option text is not.
        expect(option.targetSpan.end - option.targetSpan.start)
          .toBeLessThan(codePoints.length);
        expect(slicePronunciationText(option.text, option.targetSpan).target).toMatch(/\p{L}/u);
      });
      expect(contract.options.some((option) => option.id === contract.correctOptionId)).toBe(true);
      expect(question.options).toEqual(contract.options);
      expect(question.answer).toEqual({ correctOptionId: contract.correctOptionId });
      expect(JSON.stringify(question.options)).not.toContain('"label"');
      expect(question.answer).not.toHaveProperty("correctOption");
      expect(question.answer).not.toHaveProperty("accepted");
      expect(question.answer).not.toHaveProperty("display");
    });
  });

  it("keeps the exact 20-row canonical base set and exact ten-row replacement matrix", () => {
    const questions = indexedQuestions(readPack().pack);
    const replacements = questions.filter(({ globalNumber }) => PR17_REPLACEMENT_NUMBERS.has(globalNumber));

    expect([...PR16_RETAINED_NUMBERS]).toEqual([...PR16_RETAINED_SHA256.keys()]);
    PR16_RETAINED_SHA256.forEach((expectedHash, globalNumber) => {
      const serialized = JSON.stringify(questions[globalNumber - 1]!.question);
      expect(
        createHash("sha256").update(serialized, "utf8").digest("hex"),
        `Q${globalNumber}`,
      ).toBe(expectedHash);
    });
    expect([...PR17_REPLACEMENT_NUMBERS].sort((a, b) => a - b)).toEqual([
      2, 3, 7, 10, 11, 14, 17, 20, 21, 29,
    ]);
    expect(replacements).toHaveLength(10);
    replacements.forEach((indexed) => {
      const expected = PR17_EXPECTED_REPLACEMENTS.get(indexed.globalNumber)!;
      const contract = validatePronunciationContract(
        indexed.question.options,
        indexed.question.answer,
      );
      expect(contract.valid, `Q${indexed.globalNumber}`).toBe(true);
      expect(contract.options, `Q${indexed.globalNumber}`).toHaveLength(4);
      expect(contract.options.map(({ id, text, targetSpan }) => [
        id,
        text,
        targetSpan.start,
        targetSpan.end,
      ]), `Q${indexed.globalNumber}`).toEqual(expected.options.map(
        ([text, start, end], optionIndex) => ["ABCD"[optionIndex], text, start, end],
      ));
      expect(contract.correctOptionId, `Q${indexed.globalNumber}`).toBe(expected.answer);
      expect(clientQuestion(indexed).options, `Q${indexed.globalNumber}`).toHaveLength(4);
    });
  });

  it("normalizes the post-replacement pack cleanly with zero Pronunciation target-span warnings", () => {
    const { raw } = readPack();
    const normalized = normalizeJsonText(raw);
    const pronunciationIssues = normalized.issues.filter((issue) =>
      issue.code?.startsWith("PRONUNCIATION_")
    );

    expect(normalized.payload?.problems).toHaveLength(6);
    expect(pronunciationIssues).toHaveLength(0);

    const plan = importPlan(normalized.payload!, normalized.issues);
    const needsReview = enforceImportPublicationContract(plan, "NEEDS_REVIEW");
    const published = enforceImportPublicationContract(plan, "PUBLISHED");
    expect(needsReview.ok).toBe(true);
    expect(needsReview.summary.warnings).toBe(0);
    expect(published.ok).toBe(true);
    expect(published.summary.errors).toBe(0);
    expect(published.summary.warnings).toBe(0);
  });

  it("keeps learner projection answer-free and admin preview repair-complete", () => {
    const questions = indexedQuestions(readPack().pack);
    questions.forEach((indexed) => {
      const sourceWithPrivateFields = {
        ...learnerSource(indexed),
        rawOptions: [{ answer: "never expose" }],
        reviewedAt: new Date("2026-08-02T00:00:00.000Z"),
        reviewedById: "reviewer-secret",
        reviewEvidence: "private-review-evidence",
      };
      const dto = toLearnerQuestionDTO(sourceWithPrivateFields);
      const serialized = JSON.stringify(dto);
      expect(serialized).not.toMatch(/correctOptionId|correctOption|accepted|display|explanation|metadata|focus|rawOptions|reviewedAt|reviewedById|reviewEvidence|reviewer-secret|private-review-evidence/);
      expect(dto.options).toHaveLength(4);
    });

    readPack().pack.problems.forEach((problem, problemIndex) => {
      const preview = toAdminProblemPreviewDTO({
        id: `pilot-pronunciation-preview-${problemIndex + 1}`,
        title: problem.title,
        slug: problem.slug,
        skillType: problem.skillType,
        questionType: problem.questionType,
        difficulty: problem.difficulty,
        contentStatus: "NEEDS_REVIEW",
        statement: problem.statement,
        instructions: problem.instructions,
        estimatedMinutes: problem.estimatedMinutes,
        acceptanceRate: null,
        sourceCollection: { name: "Pilot" },
        problemTopics: [],
        questions: problem.questions.map((question, index) => ({
          ...question,
          id: `preview-${problemIndex + 1}-q${index + 1}`,
          orderIndex: index,
        })),
      });
      preview.questions.forEach((question, questionIndex) => {
        const rawQuestion = problem.questions[questionIndex]!;
        expect(question.options).toHaveLength(4);
        expect(question.rawOptions).toEqual(rawQuestion.options);
        expect(question.answer).toEqual(rawQuestion.answer);
        expect(question.explanation).toBe(rawQuestion.explanation);
        expect(question.metadata).toEqual(rawQuestion.metadata);
      });
    });
  });

  it("renders all 30 actual rows through the production component with four radios and four highlighted targets", () => {
    const questions = indexedQuestions(readPack().pack);
    questions.forEach((indexed) => {
      const dto = clientQuestion(indexed);
      const html = renderToStaticMarkup(createElement(PronunciationQuestion, {
        question: dto,
        value: "",
        onChange: vi.fn(),
      }));
      expect(html.match(/type="radio"/g), `Q${indexed.globalNumber}`).toHaveLength(4);
      expect(html.match(/underline decoration-2/g), `Q${indexed.globalNumber}`).toHaveLength(4);
    });
  });

  it("scores only the correct canonical member for all 30 actual rows and fails closed otherwise", () => {
    const questions = indexedQuestions(readPack().pack);
    questions.forEach((indexed) => {
      const scoringQuestion = {
        type: indexed.question.type,
        options: indexed.question.options,
        answer: indexed.question.answer,
        explanation: indexed.question.explanation,
      } as Parameters<typeof checkQuestionAnswer>[0];
      const correctId = (indexed.question.answer as { correctOptionId: string })
        .correctOptionId;
      ["A", "B", "C", "D"].forEach((candidate) => {
        expect(
          checkQuestionAnswer(scoringQuestion, candidate).isCorrect,
          `Q${indexed.globalNumber}:${candidate}`,
        ).toBe(candidate === correctId);
      });
      expect(checkQuestionAnswer(scoringQuestion, "E").isCorrect, `Q${indexed.globalNumber}`).toBe(false);
      expect(checkQuestionAnswer(scoringQuestion, undefined).isCorrect, `Q${indexed.globalNumber}`).toBe(false);
      expect(checkQuestionAnswer({ ...scoringQuestion, answer: {} }, correctId).isCorrect, `Q${indexed.globalNumber}`).toBe(false);
    });
  });

  it("requires every replacement-row explanation to be substantively useful and exceed the 45-character heuristic", () => {
    const questions = indexedQuestions(readPack().pack);
    PR17_REPLACEMENT_NUMBERS.forEach((globalNumber) => {
      const explanation = questions[globalNumber - 1]!.question.explanation ?? "";
      const trimmedLength = explanation.trim().length;
      expect(trimmedLength, `Q${globalNumber}`).toBeGreaterThanOrEqual(SHORT_EXPLANATION_MIN_LENGTH);
    });
  });

  it("maps every row to persisted QA contract-valid and individual publication-ready", async () => {
    const { pack } = readPack();
    const stored = storedProblems(pack);
    expect(stored.every((problem) =>
      problem.contentStatus === "NEEDS_REVIEW" &&
      problem.questions.every((question) => question.contentStatus === "NEEDS_REVIEW")
    )).toBe(true);
    const corpus = stored.flatMap((problem) => problem.questions.map((question) => ({
      id: question.id,
      problemId: question.problemId,
      type: question.type,
      prompt: question.prompt,
    })));
    const db = {
      problem: { findMany: vi.fn().mockResolvedValue(stored) },
      question: { findMany: vi.fn().mockResolvedValue(corpus) },
    };
    const report = await getContentQaReport({}, db as never);
    const pronunciationErrors = report.issues.filter((issue) =>
      issue.severity === "ERROR" && issue.code?.startsWith("PRONUNCIATION_")
    );

    expect(pronunciationErrors).toHaveLength(0);

    indexedQuestions(pack).forEach(({ globalNumber, localNumber, question }) => {
      const payload = {
        id: `pilot-pronunciation-q${globalNumber}`,
        ...question,
        orderIndex: localNumber - 1,
        contentStatus: "PUBLISHED" as const,
      };
      expect(questionPublishErrors(payload), `Q${globalNumber}`).toEqual([]);
      expect(validateQuestionEditPayload(payload).ok, `Q${globalNumber}`).toBe(true);
    });
  });

  it("does not mutate caller-owned pack objects or arrays", () => {
    const { pack } = readPack();
    const before = structuredClone(pack);
    indexedQuestions(pack).forEach((indexed) => {
      validatePronunciationContract(indexed.question.options, indexed.question.answer);
      toLearnerQuestionDTO(learnerSource(indexed));
      const contract = validatePronunciationContract(indexed.question.options, indexed.question.answer);
      contract.options.forEach((option) => slicePronunciationText(option.text, option.targetSpan));
    });
    expect(pack).toEqual(before);
  });
});
