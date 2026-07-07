import type { Difficulty, QuestionType, SkillType } from "@prisma/client";
import { difficultyLabels, skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export type DiagnosticSectionId = "use-of-english-core" | "reading" | "writing" | "listening";

export type DiagnosticBlueprintItem = {
  id: string;
  sectionId: DiagnosticSectionId;
  label: string;
  skillTypes: SkillType[];
  questionTypes: QuestionType[];
  targetCount: number;
  scored: boolean;
  optional?: boolean;
};

export type DiagnosticBlueprintSection = {
  id: DiagnosticSectionId;
  title: string;
  description: string;
  items: DiagnosticBlueprintItem[];
};

export type DiagnosticSectionPlan = {
  id: DiagnosticSectionId;
  title: string;
  description: string;
  scored: boolean;
  optional: boolean;
  targetCount: number;
  questionIds: string[];
  warning?: string;
};

export type DiagnosticCoverage = {
  sections: Array<{
    id: DiagnosticSectionId;
    title: string;
    targetCount: number;
    eligibleQuestions: number;
    publishedQuestions: number;
    status: "enough" | "missing" | "empty";
    message: string;
  }>;
  bySkill: Array<{
    skillType: SkillType;
    label: string;
    eligibleProblems: number;
    publishedProblems: number;
    eligibleQuestions: number;
    publishedQuestions: number;
  }>;
  byDifficulty: Array<{
    difficulty: Difficulty;
    label: string;
    eligibleProblems: number;
    publishedProblems: number;
  }>;
  warnings: string[];
};

const useOfEnglishSkills: SkillType[] = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
];

export const diagnosticBlueprint: DiagnosticBlueprintSection[] = [
  {
    id: "use-of-english-core",
    title: "Use of English Core",
    description: "Ngữ pháp, từ vựng, cloze, word formation, transformation và error identification.",
    items: [
      {
        id: "mcq",
        sectionId: "use-of-english-core",
        label: "Multiple Choice",
        skillTypes: ["MULTIPLE_CHOICE"],
        questionTypes: ["MCQ"],
        targetCount: 8,
        scored: true,
      },
      {
        id: "word-formation",
        sectionId: "use-of-english-core",
        label: "Word Formation",
        skillTypes: ["WORD_FORMATION"],
        questionTypes: ["WORD_FORMATION"],
        targetCount: 5,
        scored: true,
      },
      {
        id: "sentence-transformation",
        sectionId: "use-of-english-core",
        label: "Sentence Transformation",
        skillTypes: ["SENTENCE_TRANSFORMATION"],
        questionTypes: ["SENTENCE_TRANSFORMATION"],
        targetCount: 4,
        scored: true,
      },
      {
        id: "cloze",
        sectionId: "use-of-english-core",
        label: "Cloze",
        skillTypes: ["GUIDED_CLOZE", "OPEN_CLOZE"],
        questionTypes: ["GUIDED_CLOZE", "OPEN_CLOZE"],
        targetCount: 5,
        scored: true,
      },
      {
        id: "error-identification",
        sectionId: "use-of-english-core",
        label: "Error Identification",
        skillTypes: ["ERROR_IDENTIFICATION"],
        questionTypes: ["ERROR_IDENTIFICATION"],
        targetCount: 4,
        scored: true,
      },
    ],
  },
  {
    id: "reading",
    title: "Reading",
    description: "Đọc hiểu, chi tiết, suy luận, từ vựng trong ngữ cảnh và giọng điệu.",
    items: [
      {
        id: "reading-mcq",
        sectionId: "reading",
        label: "Reading MCQ",
        skillTypes: ["READING"],
        questionTypes: ["READING_MCQ"],
        targetCount: 5,
        scored: true,
      },
    ],
  },
  {
    id: "writing",
    title: "Writing",
    description: "Prompt viết để định hướng luyện tập; không tính vào level tự động nếu chưa được chấm tay.",
    items: [
      {
        id: "writing-prompt",
        sectionId: "writing",
        label: "Writing Prompt",
        skillTypes: ["WRITING"],
        questionTypes: ["WRITING_PROMPT"],
        targetCount: 1,
        scored: false,
        optional: true,
      },
    ],
  },
  {
    id: "listening",
    title: "Listening",
    description: "Future-ready cho câu hỏi nghe. Nếu chưa có dữ liệu, section này không tính vào điểm.",
    items: [
      {
        id: "listening",
        sectionId: "listening",
        label: "Listening",
        skillTypes: ["LISTENING"],
        questionTypes: ["LISTENING_MCQ", "LISTENING_SHORT_ANSWER"],
        targetCount: 3,
        scored: true,
        optional: true,
      },
    ],
  },
];

export const diagnosticAutoMarkableTypes: QuestionType[] = [
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "READING_MCQ",
  "TRIOS_GAPPED_SENTENCES",
  "SHORT_ANSWER",
  "LISTENING_MCQ",
  "LISTENING_SHORT_ANSWER",
];

export function getGymAreaForSkill(skillType: SkillType) {
  if (skillType === "READING") return "Reading";
  if (skillType === "WRITING") return "Writing";
  if (skillType === "LISTENING") return "Listening";
  if (useOfEnglishSkills.includes(skillType)) return "Use of English";
  return "Use of English";
}

export function isAutoMarkableDiagnosticType(type: QuestionType) {
  return diagnosticAutoMarkableTypes.includes(type);
}

export function getDiagnosticTargetCount() {
  return diagnosticBlueprint
    .flatMap((section) => section.items)
    .filter((item) => item.scored && !item.optional)
    .reduce((sum, item) => sum + item.targetCount, 0);
}

export function getSectionForQuestion(skillType: SkillType, type: QuestionType): DiagnosticBlueprintSection {
  return (
    diagnosticBlueprint.find((section) =>
      section.items.some((item) => item.skillTypes.includes(skillType) && item.questionTypes.includes(type)),
    ) ?? diagnosticBlueprint[0]
  );
}

export async function getDiagnosticCoverage(): Promise<DiagnosticCoverage> {
  const [problemGroups, eligibleProblemGroups, difficultyGroups, eligibleDifficultyGroups, questionGroups, eligibleQuestionGroups] =
    await Promise.all([
      prisma.problem.groupBy({
        by: ["skillType"],
        where: { contentStatus: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.problem.groupBy({
        by: ["skillType"],
        where: { contentStatus: "PUBLISHED", isDiagnosticEligible: true },
        _count: { _all: true },
      }),
      prisma.problem.groupBy({
        by: ["difficulty"],
        where: { contentStatus: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.problem.groupBy({
        by: ["difficulty"],
        where: { contentStatus: "PUBLISHED", isDiagnosticEligible: true },
        _count: { _all: true },
      }),
      prisma.question.groupBy({
        by: ["skillType"],
        where: { contentStatus: "PUBLISHED", problem: { contentStatus: "PUBLISHED" } },
        _count: { _all: true },
      }),
      prisma.question.groupBy({
        by: ["skillType"],
        where: { contentStatus: "PUBLISHED", problem: { contentStatus: "PUBLISHED", isDiagnosticEligible: true } },
        _count: { _all: true },
      }),
    ]);

  const publishedProblemsBySkill = new Map(problemGroups.map((item) => [item.skillType, item._count._all]));
  const eligibleProblemsBySkill = new Map(eligibleProblemGroups.map((item) => [item.skillType, item._count._all]));
  const publishedQuestionsBySkill = new Map(questionGroups.map((item) => [item.skillType, item._count._all]));
  const eligibleQuestionsBySkill = new Map(eligibleQuestionGroups.map((item) => [item.skillType, item._count._all]));
  const publishedProblemsByDifficulty = new Map(difficultyGroups.map((item) => [item.difficulty, item._count._all]));
  const eligibleProblemsByDifficulty = new Map(eligibleDifficultyGroups.map((item) => [item.difficulty, item._count._all]));

  const sections = diagnosticBlueprint.map((section) => {
    const targetCount = section.items.filter((item) => item.scored && !item.optional).reduce((sum, item) => sum + item.targetCount, 0);
    const skills = [...new Set(section.items.flatMap((item) => item.skillTypes))];
    const eligibleQuestions = skills.reduce((sum, skill) => sum + (eligibleQuestionsBySkill.get(skill) ?? 0), 0);
    const publishedQuestions = skills.reduce((sum, skill) => sum + (publishedQuestionsBySkill.get(skill) ?? 0), 0);
    const status: "enough" | "missing" | "empty" =
      targetCount === 0 && publishedQuestions === 0 ? "empty" : eligibleQuestions >= targetCount ? "enough" : publishedQuestions > 0 ? "missing" : "empty";
    const message =
      status === "enough"
        ? "Đủ câu hỏi"
        : status === "missing"
          ? "Thiếu câu hỏi diagnostic-eligible, hệ thống sẽ fallback sang bài đã publish."
          : section.id === "listening"
            ? "Chưa có dữ liệu Listening nên sẽ không tính vào điểm diagnostic."
            : "Chưa có dữ liệu";

    return {
      id: section.id,
      title: section.title,
      targetCount,
      eligibleQuestions,
      publishedQuestions,
      status,
      message,
    };
  });

  const allSkills = Object.keys(skillLabels) as SkillType[];
  const bySkill = allSkills.map((skillType) => ({
    skillType,
    label: skillLabels[skillType],
    eligibleProblems: eligibleProblemsBySkill.get(skillType) ?? 0,
    publishedProblems: publishedProblemsBySkill.get(skillType) ?? 0,
    eligibleQuestions: eligibleQuestionsBySkill.get(skillType) ?? 0,
    publishedQuestions: publishedQuestionsBySkill.get(skillType) ?? 0,
  }));

  const byDifficulty = (Object.keys(difficultyLabels) as Difficulty[]).map((difficulty) => ({
    difficulty,
    label: difficultyLabels[difficulty],
    eligibleProblems: eligibleProblemsByDifficulty.get(difficulty) ?? 0,
    publishedProblems: publishedProblemsByDifficulty.get(difficulty) ?? 0,
  }));

  const warnings = sections
    .filter((section) => section.status !== "enough")
    .map((section) =>
      section.id === "listening"
        ? "Listening chưa có dữ liệu nên sẽ không tính vào điểm diagnostic."
        : `${section.title} đang thiếu câu diagnostic.`,
    );

  if ((eligibleQuestionsBySkill.get("WORD_FORMATION") ?? 0) < 5) {
    warnings.push("Cần thêm câu Word Formation cấp CHUYEN.");
  }
  if ((eligibleQuestionsBySkill.get("READING") ?? 0) < 5) {
    warnings.push("Reading đang thiếu câu diagnostic.");
  }

  return { sections, bySkill, byDifficulty, warnings: [...new Set(warnings)] };
}
