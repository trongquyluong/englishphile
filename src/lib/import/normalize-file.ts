import type { Difficulty, QuestionType, SkillType, SourceType } from "@prisma/client";
import type {
  ImportIssue,
  NormalizedImportPayload,
  NormalizedProblem,
} from "@/lib/import/types";
import {
  normalizeJsonPayload,
  normalizeQuestion,
  normalizeSourceCollection,
  parseJsonText,
} from "@/lib/import/validation";
import { generateSlug } from "@/lib/import/slug";

const requiredCsvColumns = [
  "sourceName",
  "problemTitle",
  "problemSlug",
  "skillType",
  "questionType",
  "difficulty",
  "topicTags",
  "statement",
  "instructions",
  "prompt",
  "passage",
  "optionsJson",
  "answerJson",
  "explanation",
  "rootWord",
  "keyword",
  "targetSentence",
  "metadataJson",
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function parseJsonCell(value: string, path: string, issues: ImportIssue[]) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    issues.push({
      level: "error",
      path,
      message: `JSON trong ô này không hợp lệ: ${error instanceof Error ? error.message : "không đọc được"}.`,
    });
    return null;
  }
}

export function parseCsvImport(text: string) {
  const issues: ImportIssue[] = [];
  const rows = parseCsv(text.trim());

  if (rows.length < 2) {
    return {
      rows: [],
      issues: [
        {
          level: "error" as const,
          path: "csv",
          message: "CSV cần header và ít nhất một dòng dữ liệu.",
        },
      ],
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const missingColumns = requiredCsvColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length) {
    issues.push({
      level: "error",
      path: "csv.header",
      message: `Thiếu cột: ${missingColumns.join(", ")}.`,
    });
  }

  return {
    rows: rows.slice(1).map((row, rowIndex) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = row[index]?.trim() ?? "";
      });
      return { rowNumber: rowIndex + 2, record };
    }),
    issues,
  };
}

export function normalizeCsvText(text: string) {
  const parsed = parseCsvImport(text);
  const issues: ImportIssue[] = [...parsed.issues];
  const grouped = new Map<string, NormalizedProblem>();

  for (const { rowNumber, record } of parsed.rows) {
    const rowPath = `rows.${rowNumber}`;
    const sourceCollection = normalizeSourceCollection(
      {
        name: record.sourceName,
        description: `Nguồn CSV: ${record.sourceName || "Không tên"}`,
        sourceType: "CSV" as SourceType,
        copyrightNote: "Imported from admin-approved CSV.",
      },
      "CSV",
    );

    if (!sourceCollection) {
      issues.push({ level: "error", path: `${rowPath}.sourceName`, message: "sourceName là bắt buộc." });
      continue;
    }

    const options = parseJsonCell(record.optionsJson, `${rowPath}.optionsJson`, issues);
    const answer = parseJsonCell(record.answerJson, `${rowPath}.answerJson`, issues);
    const metadata = parseJsonCell(record.metadataJson, `${rowPath}.metadataJson`, issues);
    const topicTags = record.topicTags
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean);
    const slug = generateSlug(record.problemSlug || record.problemTitle);
    const groupKey = slug || generateSlug(record.problemTitle);

    if (!record.problemTitle.trim()) {
      issues.push({ level: "error", path: `${rowPath}.problemTitle`, message: "problemTitle là bắt buộc." });
      continue;
    }

    if (!record.statement.trim()) {
      issues.push({ level: "error", path: `${rowPath}.statement`, message: "statement là bắt buộc." });
      continue;
    }

    const result = normalizeQuestion(
      {
        type: record.questionType,
        skillType: record.skillType,
        difficulty: record.difficulty,
        prompt: record.prompt,
        passage: record.passage || null,
        options,
        answer,
        explanation: record.explanation || null,
        rootWord: record.rootWord || null,
        keyword: record.keyword || null,
        targetSentence: record.targetSentence || null,
        metadata,
      },
      `${rowPath}.question`,
      grouped.get(groupKey)?.questions.length ?? 0,
    );
    issues.push(...result.issues);
    if (!result.question) continue;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        title: record.problemTitle.trim(),
        slug: groupKey,
        skillType: record.skillType as SkillType,
        questionType: record.questionType as QuestionType,
        difficulty: record.difficulty as Difficulty,
        sourceCollection,
        statement: record.statement.trim(),
        instructions: record.instructions || null,
        estimatedMinutes: null,
        topics: topicTags,
        questions: [],
        orderIndex: grouped.size,
      });
    }

    const problem = grouped.get(groupKey);
    if (problem) {
      problem.questions.push({ ...result.question, orderIndex: problem.questions.length });
      problem.topics = [...new Set([...problem.topics, ...topicTags])];
    }
  }

  return {
    payload: {
      importType: "CSV" as const,
      problems: [...grouped.values()],
    } satisfies NormalizedImportPayload,
    issues,
  };
}

export function normalizeJsonText(text: string) {
  const parsed = parseJsonText(text);
  if (!parsed.data) {
    return {
      payload: null,
      issues: parsed.issues,
    };
  }
  return normalizeJsonPayload(parsed.data);
}

export function normalizeImportFile(importType: "JSON" | "CSV", text: string) {
  return importType === "CSV" ? normalizeCsvText(text) : normalizeJsonText(text);
}
