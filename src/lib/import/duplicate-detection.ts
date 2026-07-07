import type { NormalizedProblem, NormalizedQuestion } from "@/lib/import/types";
import { prisma } from "@/lib/prisma";

type DuplicateCandidate = {
  id: string;
  prompt: string;
  passage: string | null;
  options: unknown;
  answer: unknown;
  problem: {
    id: string;
    title: string;
    statement: string;
  };
};

export type ImportDuplicateRisk = {
  level: "NONE" | "EXACT" | "HIGH_SIMILARITY" | "POSSIBLE";
  similarity: number;
  action: "import" | "skip" | "needs_review";
  existingQuestionId?: string;
  existingProblemId?: string;
  existingProblemTitle?: string;
  existingPromptExcerpt?: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeQuestionText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function normalizeAnswerForDuplicateCheck(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

function optionText(options: unknown) {
  if (!Array.isArray(options)) return "";
  return options
    .map((option) => {
      const item = asRecord(option);
      return [item.id, item.label, item.text].filter(Boolean).join(" ");
    })
    .join(" ");
}

function questionComparableText(question: Pick<NormalizedQuestion, "prompt" | "passage" | "options">, problemContext = "") {
  return normalizeQuestionText([problemContext, question.passage, question.prompt, optionText(question.options)].filter(Boolean).join(" "));
}

export function getQuestionFingerprint(question: NormalizedQuestion, problemContext = "") {
  return [
    question.type,
    question.skillType,
    questionComparableText(question, problemContext),
    normalizeAnswerForDuplicateCheck(question.answer),
  ].join("::");
}

function tokens(value: string) {
  return new Set(value.split(" ").filter((token) => token.length > 1));
}

function trigrams(value: string) {
  const compact = value.replace(/\s+/g, " ");
  if (compact.length < 3) return new Set(compact ? [compact] : []);
  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) {
    grams.add(compact.slice(index, index + 3));
  }
  return grams;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (left.size === 0 && right.size === 0) return 1;
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

export function calculateTextSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeQuestionText(left);
  const normalizedRight = normalizeQuestionText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const tokenScore = jaccard(tokens(normalizedLeft), tokens(normalizedRight));
  const trigramScore = jaccard(trigrams(normalizedLeft), trigrams(normalizedRight));
  return Number(((tokenScore * 0.55) + (trigramScore * 0.45)).toFixed(4));
}

function toNormalizedCandidate(candidate: DuplicateCandidate): Pick<NormalizedQuestion, "prompt" | "passage" | "options" | "answer"> {
  return {
    prompt: candidate.prompt,
    passage: candidate.passage,
    options: candidate.options,
    answer: candidate.answer,
  };
}

export async function findExactDuplicateQuestion(problem: NormalizedProblem, question: NormalizedQuestion) {
  const candidates = await prisma.question.findMany({
    where: {
      type: question.type,
      skillType: question.skillType,
      problem: { contentStatus: { not: "ARCHIVED" } },
    },
    include: { problem: { select: { id: true, title: true, statement: true } } },
    take: 500,
  });
  const fingerprint = getQuestionFingerprint(question, `${problem.title} ${problem.statement}`);
  return candidates.find((candidate) => {
    const candidateQuestion = {
      ...toNormalizedCandidate(candidate),
      type: candidate.type,
      skillType: candidate.skillType,
    } as NormalizedQuestion;
    return fingerprint === getQuestionFingerprint(candidateQuestion, `${candidate.problem.title} ${candidate.problem.statement}`);
  });
}

export async function findNearDuplicateQuestions(problem: NormalizedProblem, question: NormalizedQuestion) {
  const candidates = await prisma.question.findMany({
    where: {
      type: question.type,
      skillType: question.skillType,
      problem: { contentStatus: { not: "ARCHIVED" } },
    },
    include: { problem: { select: { id: true, title: true, statement: true } } },
    take: 500,
  });
  const questionText = questionComparableText(question, `${problem.title} ${problem.statement}`);
  return candidates
    .map((candidate) => {
      const candidateText = questionComparableText(toNormalizedCandidate(candidate), `${candidate.problem.title} ${candidate.problem.statement}`);
      return { candidate, similarity: calculateTextSimilarity(questionText, candidateText) };
    })
    .filter((item) => item.similarity >= 0.75)
    .sort((left, right) => right.similarity - left.similarity);
}

export async function detectImportDuplicates(problem: NormalizedProblem, question: NormalizedQuestion): Promise<ImportDuplicateRisk> {
  const exact = await findExactDuplicateQuestion(problem, question);
  if (exact) {
    return {
      level: "EXACT",
      similarity: 1,
      action: "skip",
      existingQuestionId: exact.id,
      existingProblemId: exact.problem.id,
      existingProblemTitle: exact.problem.title,
      existingPromptExcerpt: exact.prompt.slice(0, 120),
    };
  }

  const [nearest] = await findNearDuplicateQuestions(problem, question);
  if (!nearest) {
    return { level: "NONE", similarity: 0, action: "import" };
  }

  const common = {
    similarity: nearest.similarity,
    existingQuestionId: nearest.candidate.id,
    existingProblemId: nearest.candidate.problem.id,
    existingProblemTitle: nearest.candidate.problem.title,
    existingPromptExcerpt: nearest.candidate.prompt.slice(0, 120),
  };

  if (nearest.similarity >= 0.9) {
    return {
      level: "HIGH_SIMILARITY",
      action: "skip",
      ...common,
    };
  }

  return {
    level: "POSSIBLE",
    action: "needs_review",
    ...common,
  };
}

export function attachDuplicateRiskMetadata(question: NormalizedQuestion, risk: ImportDuplicateRisk): NormalizedQuestion {
  const metadata = asRecord(question.metadata);
  return {
    ...question,
    metadata: {
      ...metadata,
      duplicateRisk: {
        level: risk.level,
        similarity: risk.similarity,
        existingQuestionId: risk.existingQuestionId,
        existingProblemId: risk.existingProblemId,
        existingProblemTitle: risk.existingProblemTitle,
        existingPromptExcerpt: risk.existingPromptExcerpt,
      },
    },
  };
}
