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

const BLOCKED = new Map<number, string>([
  [2, "BLOCKED_DIALECT_AMBIGUITY"],
  [3, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
  [7, "BLOCKED_UNCLEAR_UNDERLINE"],
  [10, "BLOCKED_DIALECT_AMBIGUITY"],
  [11, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
  [14, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
  [17, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
  [20, "BLOCKED_UNCLEAR_UNDERLINE"],
  [21, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
  [29, "BLOCKED_DIALECT_AMBIGUITY"],
]);

const EXPECTED_TARGETS = new Map<number, readonly string[]>([
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
]);

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

describe("Pronunciation pilot pack 001 repaired content", () => {
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

  it("validates every repaired row and slices exactly the reviewed code-point target", () => {
    const questions = indexedQuestions(readPack().pack);
    const repaired = questions.filter(({ globalNumber }) => !BLOCKED.has(globalNumber));

    expect(repaired).toHaveLength(20);
    repaired.forEach(({ globalNumber, question }) => {
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
        const codePoints = pronunciationCodePoints(option.text);
        expect(option.targetSpan.start).toBeGreaterThanOrEqual(0);
        expect(option.targetSpan.start).toBeLessThan(option.targetSpan.end);
        expect(option.targetSpan.end).toBeLessThanOrEqual(codePoints.length);
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

  it("lists every blocked row explicitly and keeps it fail-closed", () => {
    const questions = indexedQuestions(readPack().pack);
    const blocked = questions.filter(({ globalNumber }) => BLOCKED.has(globalNumber));

    expect(blocked.map(({ globalNumber }) => [globalNumber, BLOCKED.get(globalNumber)])).toEqual([
      [2, "BLOCKED_DIALECT_AMBIGUITY"],
      [3, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
      [7, "BLOCKED_UNCLEAR_UNDERLINE"],
      [10, "BLOCKED_DIALECT_AMBIGUITY"],
      [11, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
      [14, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
      [17, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
      [20, "BLOCKED_UNCLEAR_UNDERLINE"],
      [21, "BLOCKED_MULTIPLE_DEFENSIBLE_ANSWERS"],
      [29, "BLOCKED_DIALECT_AMBIGUITY"],
    ]);
    blocked.forEach((indexed) => {
      const contract = validatePronunciationContract(indexed.question.options, indexed.question.answer);
      expect(contract.valid, `Q${indexed.globalNumber}`).toBe(false);
      expect(contract.options, `Q${indexed.globalNumber}`).toEqual([]);
      expect(clientQuestion(indexed).options, `Q${indexed.globalNumber}`).toEqual([]);
    });
  });

  it("normalizes repaired rows cleanly while retaining exactly 40 blocked span warnings", () => {
    const { raw } = readPack();
    const normalized = normalizeJsonText(raw);
    const pronunciationIssues = normalized.issues.filter((issue) =>
      issue.code?.startsWith("PRONUNCIATION_")
    );

    expect(normalized.payload?.problems).toHaveLength(6);
    expect(pronunciationIssues).toHaveLength(40);
    expect(pronunciationIssues.every((issue) =>
      issue.level === "warning" && issue.code === "PRONUNCIATION_TARGET_SPAN_REQUIRED"
    )).toBe(true);
    const issueGlobals = pronunciationIssues.map((issue) => {
      const match = /^problems\.(\d+)\.questions\.(\d+)\./.exec(issue.path);
      expect(match).not.toBeNull();
      return Number(match?.[1]) * 5 + Number(match?.[2]) + 1;
    });
    expect([...new Set(issueGlobals)]).toEqual([...BLOCKED.keys()]);

    const plan = importPlan(normalized.payload!, normalized.issues);
    const needsReview = enforceImportPublicationContract(plan, "NEEDS_REVIEW");
    const published = enforceImportPublicationContract(plan, "PUBLISHED");
    expect(needsReview.ok).toBe(true);
    expect(needsReview.summary.warnings).toBe(40);
    expect(published.ok).toBe(false);
    expect(published.summary.errors).toBe(40);
    expect(published.summary.warnings).toBe(0);
  });

  it("keeps learner projection answer-free and admin preview repair-complete", () => {
    const questions = indexedQuestions(readPack().pack);
    questions.forEach((indexed) => {
      const dto = toLearnerQuestionDTO(learnerSource(indexed));
      const serialized = JSON.stringify(dto);
      expect(serialized).not.toMatch(/correctOptionId|correctOption|accepted|display|explanation|metadata|focus/);
      expect(dto.options).toHaveLength(BLOCKED.has(indexed.globalNumber) ? 0 : 4);
    });

    const firstProblem = readPack().pack.problems[0];
    const preview = toAdminProblemPreviewDTO({
      id: "pilot-pronunciation-preview",
      title: firstProblem.title,
      slug: firstProblem.slug,
      skillType: firstProblem.skillType,
      questionType: firstProblem.questionType,
      difficulty: firstProblem.difficulty,
      contentStatus: "NEEDS_REVIEW",
      statement: firstProblem.statement,
      instructions: firstProblem.instructions,
      estimatedMinutes: firstProblem.estimatedMinutes,
      acceptanceRate: null,
      sourceCollection: { name: "Pilot" },
      problemTopics: [],
      questions: firstProblem.questions.map((question, index) => ({
        ...question,
        id: `preview-q${index + 1}`,
        orderIndex: index,
      })),
    });
    expect(preview.questions[0]?.options).toHaveLength(4);
    expect(preview.questions[0]?.rawOptions).toEqual(firstProblem.questions[0]?.options);
    expect(preview.questions[0]?.answer).toEqual(firstProblem.questions[0]?.answer);
    expect(preview.questions[1]?.options).toEqual([]);
    expect(preview.questions[1]?.rawOptions).toEqual(firstProblem.questions[1]?.options);
  });

  it("renders one actual repaired row and one actual blocked row through the production component", () => {
    const questions = indexedQuestions(readPack().pack);
    const repaired = clientQuestion(questions[0]!);
    const blocked = clientQuestion(questions[1]!);
    const repairedHtml = renderToStaticMarkup(createElement(PronunciationQuestion, {
      question: repaired,
      value: "",
      onChange: vi.fn(),
    }));
    const blockedHtml = renderToStaticMarkup(createElement(PronunciationQuestion, {
      question: blocked,
      value: "",
      onChange: vi.fn(),
    }));

    expect(repairedHtml.match(/type="radio"/g)).toHaveLength(4);
    expect(repairedHtml.match(/underline decoration-2/g)).toHaveLength(4);
    expect(blockedHtml).toContain('role="status"');
    expect(blockedHtml).toContain("chưa có đủ dữ liệu gạch chân hợp lệ");
    expect(blockedHtml).not.toContain('type="radio"');
  });

  it("scores an actual repaired member answer and fails closed otherwise", () => {
    const question = indexedQuestions(readPack().pack)[0]!.question;
    const scoringQuestion = {
      type: question.type,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
    } as Parameters<typeof checkQuestionAnswer>[0];

    expect(checkQuestionAnswer(scoringQuestion, "B").isCorrect).toBe(true);
    expect(checkQuestionAnswer(scoringQuestion, "A").isCorrect).toBe(false);
    expect(checkQuestionAnswer(scoringQuestion, undefined).isCorrect).toBe(false);
    expect(checkQuestionAnswer({ ...scoringQuestion, answer: {} }, "B").isCorrect).toBe(false);
  });

  it("maps actual blocked rows to persisted QA errors and structural publication blockers", async () => {
    const { pack } = readPack();
    const stored = storedProblems(pack);
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

    expect(pronunciationErrors.length).toBeGreaterThanOrEqual(40);
    expect(pronunciationErrors.filter(
      (issue) => issue.code === "PRONUNCIATION_TARGET_SPAN_REQUIRED",
    )).toHaveLength(40);
    expect(new Set(pronunciationErrors.map((issue) => issue.entityId))).toEqual(
      new Set([...BLOCKED.keys()].map((number) => `pilot-pronunciation-q${number}`)),
    );

    indexedQuestions(pack).forEach(({ globalNumber, localNumber, question }) => {
      const payload = {
        id: `pilot-pronunciation-q${globalNumber}`,
        ...question,
        orderIndex: localNumber - 1,
        contentStatus: "PUBLISHED" as const,
      };
      if (BLOCKED.has(globalNumber)) {
        expect(questionPublishErrors(payload).length, `Q${globalNumber}`).toBeGreaterThan(0);
        expect(validateQuestionEditPayload(payload).ok, `Q${globalNumber}`).toBe(false);
      } else {
        expect(questionPublishErrors(payload), `Q${globalNumber}`).toEqual([]);
        expect(validateQuestionEditPayload(payload).ok, `Q${globalNumber}`).toBe(true);
      }
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
