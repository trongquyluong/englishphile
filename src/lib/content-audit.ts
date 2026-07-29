import { normalizeContentPackFileName } from "@/lib/content-packs/file-identity";
import {
  normalizeErrorIdentificationAnswer,
  normalizeErrorIdentificationOptions,
  validateErrorIdentificationContract,
} from "@/lib/questions/error-identification-contract";

export const SHORT_EXPLANATION_THRESHOLD = 45;
const MAX_OPTION_AMBIGUITY_GROUPS = 12;
const MAX_OPTION_AMBIGUITY_VALUES_PER_GROUP = 8;

const optionQuestionTypes = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "GUIDED_CLOZE",
  "READING_MCQ",
  "LISTENING_MCQ",
]);

const optionRendererQuestionTypes = new Set([
  ...optionQuestionTypes,
  "ERROR_IDENTIFICATION",
]);

const genericPromptQuestionTypes = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "TRIOS_GAPPED_SENTENCES",
]);

export type AuditLocation = {
  packDirectory: string;
  fileName: string;
  problemIndex: number;
  problemSlug?: string;
  questionIndex?: number;
  promptExcerpt?: string;
};

export type AuditCount = {
  problems: number;
  questions: number;
};

export type ManifestFileEntry = {
  fileName: string;
  problemCount?: number;
  questionCount?: number;
};

export type ManifestIssue = {
  packDirectory: string;
  fileName?: string;
  path: string;
  message: string;
};

export type ManifestMismatch = {
  packDirectory: string;
  fileName?: string;
  field: "files" | "problems" | "questions";
  expected: number;
  actual: number;
};

export type ContentPackAuditFileInput = {
  fileName: string;
  payload?: unknown;
  parseError?: string;
  normalizationIssues?: {
    level: "error" | "warning";
    path: string;
    message: string;
  }[];
};

export type ContentPackAuditInput = {
  directory: string;
  manifest?: unknown;
  manifestParseError?: string;
  files: ContentPackAuditFileInput[];
};

export type ContentPackInventory = {
  directory: string;
  name: string;
  splitFiles: number;
  problems: number;
  questions: number;
};

export type DuplicatePromptGroup = {
  occurrences: number;
  locations: AuditLocation[];
};

export type RendererOptionIssue =
  | "TOO_FEW_RENDERABLE_OPTIONS"
  | "OPTION_COUNT_NOT_FOUR"
  | "INVALID_OPTION_ID"
  | "DUPLICATE_OPTION_ID"
  | "INVALID_OPTION_TEXT"
  | "ANSWER_NOT_IN_RENDERED_OPTIONS";

export type RendererOptionFinding = AuditLocation & {
  issues: RendererOptionIssue[];
  optionIds: Array<string | null>;
  optionTexts: Array<string | null>;
  selectedAnswer: string | null;
};

export type DuplicateNormalizedOptionTextGroup = {
  normalizedTextKey: string;
  occurrences: number;
  rawDisplayValues: string[];
  omittedValues: number;
};

export type DuplicateNormalizedOptionTextFinding = AuditLocation & {
  questionType: string;
  duplicateGroupCount: number;
  groups: DuplicateNormalizedOptionTextGroup[];
  omittedGroups: number;
};

export type ContentAuditReport = {
  inventory: {
    packs: number;
    splitFiles: number;
    problems: number;
    questions: number;
    optionQuestions: number;
  };
  packs: ContentPackInventory[];
  bySkill: Record<string, AuditCount>;
  byQuestionType: Record<string, number>;
  byDifficulty: Record<string, AuditCount>;
  answerPositions: Record<string, number>;
  findings: {
    problemsWithoutInstructions: AuditLocation[];
    missingExplanations: AuditLocation[];
    shortExplanations: AuditLocation[];
    wordFormationWithoutRootWords: AuditLocation[];
    readingQuestionsWithoutPassages: AuditLocation[];
    triosWithoutThreeSentences: AuditLocation[];
    skillMismatches: AuditLocation[];
    difficultyMismatches: AuditLocation[];
    invalidCorrectOptions: AuditLocation[];
    rendererIncompatibleOptions: RendererOptionFinding[];
    duplicateNormalizedOptionTexts: DuplicateNormalizedOptionTextFinding[];
    duplicatePromptGroups: DuplicatePromptGroup[];
  };
  manifestMismatches: ManifestMismatch[];
  malformedInputs: ManifestIssue[];
  normalizerWarnings: ManifestIssue[];
  hasInventoryErrors: boolean;
};

type ManifestResult = {
  name: string;
  entries: ManifestFileEntry[];
  totals: {
    files?: number;
    problems?: number;
    questions?: number;
  };
  issues: Omit<ManifestIssue, "packDirectory">[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function rawNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function incrementCount(
  record: Record<string, AuditCount>,
  key: string,
  field: keyof AuditCount,
) {
  const count = record[key] ?? { problems: 0, questions: 0 };
  count[field] += 1;
  record[key] = count;
}

function ordinalCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCanonicalText(left = "", right = "") {
  const canonicalDifference = ordinalCompare(
    left.normalize("NFC"),
    right.normalize("NFC"),
  );
  return canonicalDifference || ordinalCompare(left, right);
}

function compareFileNames(left = "", right = "") {
  const normalizedDifference = ordinalCompare(
    normalizeContentPackFileName(left),
    normalizeContentPackFileName(right),
  );
  return normalizedDifference || ordinalCompare(left, right);
}

function compareAuditLocations(left: AuditLocation, right: AuditLocation) {
  return (
    compareCanonicalText(left.packDirectory, right.packDirectory) ||
    compareFileNames(left.fileName, right.fileName) ||
    left.problemIndex - right.problemIndex ||
    (left.questionIndex ?? -1) - (right.questionIndex ?? -1) ||
    compareCanonicalText(left.problemSlug, right.problemSlug) ||
    compareCanonicalText(left.promptExcerpt, right.promptExcerpt)
  );
}

function compareManifestIssues(left: ManifestIssue, right: ManifestIssue) {
  return (
    compareCanonicalText(left.packDirectory, right.packDirectory) ||
    compareFileNames(left.fileName, right.fileName) ||
    compareCanonicalText(left.path, right.path) ||
    compareCanonicalText(left.message, right.message)
  );
}

function compareManifestMismatches(
  left: ManifestMismatch,
  right: ManifestMismatch,
) {
  return (
    compareCanonicalText(left.packDirectory, right.packDirectory) ||
    compareFileNames(left.fileName, right.fileName) ||
    compareCanonicalText(left.field, right.field) ||
    left.expected - right.expected ||
    left.actual - right.actual
  );
}

function comparePackInventories(
  left: ContentPackInventory,
  right: ContentPackInventory,
) {
  return (
    compareCanonicalText(left.directory, right.directory) ||
    compareCanonicalText(left.name, right.name) ||
    left.splitFiles - right.splitFiles ||
    left.problems - right.problems ||
    left.questions - right.questions
  );
}

function sortedCopy<T>(values: T[], compare: (left: T, right: T) => number) {
  return [...values].sort(compare);
}

function sortedNumberRecord(record: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      compareCanonicalText(left, right),
    ),
  );
}

function sortedCountRecord(record: Record<string, AuditCount>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      compareCanonicalText(left, right),
    ),
  );
}

function isSafeImportFileName(fileName: string) {
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName === "." ||
    fileName === ".." ||
    fileName.includes("\0")
  ) {
    return false;
  }

  const normalized = normalizeContentPackFileName(fileName);
  return (normalized.endsWith(".json") || normalized.endsWith(".csv")) && normalized !== "manifest.json";
}

function parseOptionalCount(
  record: Record<string, unknown>,
  aliases: string[],
  path: string,
  issues: Omit<ManifestIssue, "packDirectory">[],
) {
  const presentAlias = aliases.find((alias) => record[alias] !== undefined);
  if (!presentAlias) return undefined;
  const value = nonNegativeInteger(record[presentAlias]);
  if (value === undefined) {
    issues.push({
      path: `${path}.${presentAlias}`,
      message: "Manifest count must be a non-negative integer.",
    });
  }
  return value;
}

export function parseContentPackManifest(manifest: unknown): ManifestResult {
  const issues: Omit<ManifestIssue, "packDirectory">[] = [];
  if (!isRecord(manifest)) {
    return {
      name: "Unnamed content pack",
      entries: [],
      totals: {},
      issues: [{ path: "manifest", message: "Manifest must be a JSON object." }],
    };
  }

  const name =
    nonEmptyString(manifest.packName) ??
    nonEmptyString(manifest.name) ??
    "Unnamed content pack";

  if (!Array.isArray(manifest.files)) {
    issues.push({
      path: "manifest.files",
      message: "Manifest files must be an array.",
    });
    return { name, entries: [], totals: {}, issues };
  }

  const entries: ManifestFileEntry[] = [];
  const seenFileNames = new Set<string>();

  manifest.files.forEach((rawEntry, index) => {
    const path = `manifest.files.${index}`;
    if (!isRecord(rawEntry)) {
      issues.push({ path, message: "Manifest file entry must be an object." });
      return;
    }

    const fileName =
      rawNonEmptyString(rawEntry.fileName) ?? rawNonEmptyString(rawEntry.file);
    if (!fileName) {
      issues.push({
        path,
        message: "Manifest file entry needs fileName or file.",
      });
      return;
    }
    if (!isSafeImportFileName(fileName)) {
      issues.push({
        fileName,
        path,
        message: "Manifest entry is not a safe supported JSON/CSV file.",
      });
      return;
    }

    const normalizedFileName = normalizeContentPackFileName(fileName);
    if (seenFileNames.has(normalizedFileName)) {
      issues.push({
        fileName,
        path,
        message: "Manifest contains a duplicate file entry.",
      });
      return;
    }
    seenFileNames.add(normalizedFileName);

    entries.push({
      fileName,
      problemCount: parseOptionalCount(
        rawEntry,
        ["problemCount", "problems"],
        path,
        issues,
      ),
      questionCount: parseOptionalCount(
        rawEntry,
        ["questionCount", "questions"],
        path,
        issues,
      ),
    });
  });

  const rawTotals = isRecord(manifest.totals) ? manifest.totals : manifest;
  const totalsPath = isRecord(manifest.totals) ? "manifest.totals" : "manifest";

  return {
    name,
    entries,
    totals: {
      files: parseOptionalCount(
        rawTotals,
        isRecord(manifest.totals)
          ? ["fileCount", "files"]
          : ["totalIndividualFiles", "fileCount"],
        totalsPath,
        issues,
      ),
      problems: parseOptionalCount(
        rawTotals,
        isRecord(manifest.totals)
          ? ["problemCount", "problems"]
          : ["totalProblems", "problemCount"],
        totalsPath,
        issues,
      ),
      questions: parseOptionalCount(
        rawTotals,
        isRecord(manifest.totals)
          ? ["questionCount", "questions"]
          : ["totalQuestions", "questionCount"],
        totalsPath,
        issues,
      ),
    },
    issues,
  };
}

function learnerVisiblePrimitive(value: unknown) {
  // Keep this audit-local to avoid coupling the Node CLI to DTO/scorer modules.
  // Learner options stringify string/number values; checkMCQ then trims and
  // uppercases identifiers.
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function canonicalScoringIdentifier(value: unknown) {
  const visible = learnerVisiblePrimitive(value);
  if (!visible?.trim()) return undefined;
  return visible.trim().toUpperCase();
}

function learnerVisibleDisplayText(value: unknown) {
  const visible = learnerVisiblePrimitive(value);
  return visible?.trim() ? visible : undefined;
}

function normalizedDisplayText(value: unknown) {
  const visible = learnerVisibleDisplayText(value);
  if (!visible) return undefined;
  // Editorial ambiguity heuristic only. Learner renderers display String(...)
  // values literally and do not apply this normalization.
  return visible
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function safeVisibleValue(value: unknown) {
  const visible = learnerVisiblePrimitive(value);
  if (visible === undefined) return null;
  return visible.length <= 120 ? visible : `${visible.slice(0, 117)}...`;
}

function rendererAnswerValue(questionType: string, answer: unknown) {
  if (!isRecord(answer)) return undefined;
  const canonical =
    questionType === "ERROR_IDENTIFICATION"
      ? answer.correctPart
      : answer.correctOptionId;
  const alias =
    questionType === "ERROR_IDENTIFICATION"
      ? answer.errorPart
      : answer.correctOption;

  // Mirror importer alias precedence: an existing string canonical field wins
  // even when blank; otherwise a string alias is promoted. Numeric canonical
  // values remain scorer-compatible for defensive auditing of stored JSON.
  if (typeof canonical === "string") return canonical;
  if (typeof alias === "string") return alias;
  return typeof canonical === "number" ? canonical : undefined;
}

function rendererAnswerIdentifier(questionType: string, answer: unknown) {
  const value = rendererAnswerValue(questionType, answer);
  if (value === undefined) {
    return undefined;
  }
  return canonicalScoringIdentifier(value);
}

function hasThreeTriosSentences(question: Record<string, unknown>) {
  if (isRecord(question.metadata)) {
    const sentences = question.metadata.sentences;
    if (
      Array.isArray(sentences) &&
      sentences.length === 3 &&
      sentences.every((sentence) => Boolean(nonEmptyString(sentence)))
    ) {
      return true;
    }
  }

  const passage = nonEmptyString(question.passage);
  if (!passage) return false;
  const lines = passage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length === 3;
}

function normalizedPrompt(value: unknown) {
  const prompt = nonEmptyString(value);
  if (!prompt) return "";
  return prompt.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function promptExcerpt(value: unknown) {
  const prompt = nonEmptyString(value);
  if (!prompt) return undefined;
  const compact = prompt.normalize("NFKC").replace(/\s+/g, " ");
  return compact.length <= 120 ? compact : `${compact.slice(0, 117)}...`;
}

function locationFor(
  packDirectory: string,
  fileName: string,
  problemIndex: number,
  problem: Record<string, unknown>,
  questionIndex?: number,
  question?: Record<string, unknown>,
): AuditLocation {
  return {
    packDirectory,
    fileName,
    problemIndex,
    ...(nonEmptyString(problem.slug)
      ? { problemSlug: nonEmptyString(problem.slug) }
      : {}),
    ...(questionIndex === undefined ? {} : { questionIndex }),
    ...(question ? { promptExcerpt: promptExcerpt(question.prompt) } : {}),
  };
}

function addMismatch(
  mismatches: ManifestMismatch[],
  packDirectory: string,
  field: ManifestMismatch["field"],
  expected: number | undefined,
  actual: number,
  fileName?: string,
) {
  if (expected !== undefined && expected !== actual) {
    mismatches.push({
      packDirectory,
      ...(fileName ? { fileName } : {}),
      field,
      expected,
      actual,
    });
  }
}

export function auditContentPacks(
  inputs: ContentPackAuditInput[],
): ContentAuditReport {
  const report: ContentAuditReport = {
    inventory: {
      packs: inputs.length,
      splitFiles: 0,
      problems: 0,
      questions: 0,
      optionQuestions: 0,
    },
    packs: [],
    bySkill: {},
    byQuestionType: {},
    byDifficulty: {},
    answerPositions: {},
    findings: {
      problemsWithoutInstructions: [],
      missingExplanations: [],
      shortExplanations: [],
      wordFormationWithoutRootWords: [],
      readingQuestionsWithoutPassages: [],
      triosWithoutThreeSentences: [],
      skillMismatches: [],
      difficultyMismatches: [],
      invalidCorrectOptions: [],
      rendererIncompatibleOptions: [],
      duplicateNormalizedOptionTexts: [],
      duplicatePromptGroups: [],
    },
    manifestMismatches: [],
    malformedInputs: [],
    normalizerWarnings: [],
    hasInventoryErrors: false,
  };

  const duplicateCandidates = new Map<string, AuditLocation[]>();

  for (const input of inputs) {
    const hasManifest =
      input.manifest !== undefined || input.manifestParseError !== undefined;
    const manifest = hasManifest
      ? parseContentPackManifest(input.manifest)
      : {
          name: input.directory,
          entries: [],
          totals: {},
          issues: [],
        };
    if (input.manifestParseError) {
      report.malformedInputs.push({
        packDirectory: input.directory,
        path: "manifest",
        message: input.manifestParseError,
      });
    }
    report.malformedInputs.push(
      ...manifest.issues.map((issue) => ({
        packDirectory: input.directory,
        ...issue,
      })),
    );

    const providedFiles = new Map<string, ContentPackAuditFileInput>();
    const selectedNameCounts = new Map<string, number>();
    for (const file of input.files) {
      const normalizedFileName = normalizeContentPackFileName(file.fileName);
      if (!providedFiles.has(normalizedFileName)) {
        providedFiles.set(normalizedFileName, file);
      }
      selectedNameCounts.set(
        normalizedFileName,
        (selectedNameCounts.get(normalizedFileName) ?? 0) + 1,
      );
    }
    const collidedSelectedNames = new Set(
      [...selectedNameCounts]
        .filter(([, count]) => count > 1)
        .map(([normalizedFileName]) => normalizedFileName),
    );
    for (const file of input.files) {
      if (collidedSelectedNames.has(normalizeContentPackFileName(file.fileName))) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: file.fileName,
          path: "files",
          message: "Importer-selected filename collides after importer normalization.",
        });
      }
    }
    const manifestFiles = new Map(
      manifest.entries.map((entry) => [
        normalizeContentPackFileName(entry.fileName),
        entry,
      ]),
    );
    if (hasManifest) {
      for (const entry of manifest.entries) {
        if (!providedFiles.has(normalizeContentPackFileName(entry.fileName))) {
          report.malformedInputs.push({
            packDirectory: input.directory,
            fileName: entry.fileName,
            path: "file",
            message: "Manifest entry is missing from the importer-selected directory set.",
          });
        }
      }
      for (const file of input.files) {
        if (!manifestFiles.has(normalizeContentPackFileName(file.fileName))) {
          report.malformedInputs.push({
            packDirectory: input.directory,
            fileName: file.fileName,
            path: "file",
            message: "Importer-selected file is not listed in the manifest.",
          });
        }
      }
    }
    const packInventory: ContentPackInventory = {
      directory: input.directory,
      name: manifest.name,
      splitFiles: input.files.length,
      problems: 0,
      questions: 0,
    };

    report.inventory.splitFiles += input.files.length;

    for (const file of input.files) {
      const normalizedFileName = normalizeContentPackFileName(file.fileName);
      const entry = manifestFiles.get(normalizedFileName);
      if (collidedSelectedNames.has(normalizedFileName)) {
        continue;
      }
      if (file.parseError) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: file.fileName,
          path: "file",
          message: file.parseError,
        });
        continue;
      }
      const normalizationErrors = (file.normalizationIssues ?? []).filter(
        (issue) => issue.level === "error",
      );
      report.malformedInputs.push(
        ...normalizationErrors.map((issue) => ({
          packDirectory: input.directory,
          fileName: file.fileName,
          path: issue.path,
          message: issue.message,
        })),
      );
      report.normalizerWarnings.push(
        ...(file.normalizationIssues ?? [])
          .filter((issue) => issue.level === "warning")
          .map((issue) => ({
            packDirectory: input.directory,
            fileName: file.fileName,
            path: issue.path,
            message: issue.message,
          })),
      );
      if (normalizationErrors.length > 0) continue;
      if (!isRecord(file.payload) || !Array.isArray(file.payload.problems)) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: file.fileName,
          path: "payload.problems",
          message: "Normalized import payload must contain a problems array.",
        });
        continue;
      }

      const problems = file.payload.problems;
      let fileQuestionCount = 0;
      packInventory.problems += problems.length;
      report.inventory.problems += problems.length;

      problems.forEach((rawProblem, problemIndex) => {
        if (!isRecord(rawProblem)) {
          report.malformedInputs.push({
            packDirectory: input.directory,
            fileName: file.fileName,
            path: `problems.${problemIndex}`,
            message: "Problem must be an object.",
          });
          return;
        }

        const problemLocation = locationFor(
          input.directory,
          file.fileName,
          problemIndex,
          rawProblem,
        );
        const problemSkill = nonEmptyString(rawProblem.skillType) ?? "UNKNOWN";
        const problemDifficulty =
          nonEmptyString(rawProblem.difficulty) ?? "UNKNOWN";
        incrementCount(report.bySkill, problemSkill, "problems");
        incrementCount(report.byDifficulty, problemDifficulty, "problems");

        if (!nonEmptyString(rawProblem.instructions)) {
          report.findings.problemsWithoutInstructions.push(problemLocation);
        }

        if (!Array.isArray(rawProblem.questions)) {
          report.malformedInputs.push({
            packDirectory: input.directory,
            fileName: file.fileName,
            path: `problems.${problemIndex}.questions`,
            message: "Problem questions must be an array.",
          });
          return;
        }

        const questions = rawProblem.questions;
        fileQuestionCount += questions.length;
        packInventory.questions += questions.length;
        report.inventory.questions += questions.length;

        const problemHasReadingPassage = questions.some(
          (question) =>
            isRecord(question) && Boolean(nonEmptyString(question.passage)),
        );

        questions.forEach((rawQuestion, questionIndex) => {
          if (!isRecord(rawQuestion)) {
            report.malformedInputs.push({
              packDirectory: input.directory,
              fileName: file.fileName,
              path: `problems.${problemIndex}.questions.${questionIndex}`,
              message: "Question must be an object.",
            });
            return;
          }
          const questionLocation = locationFor(
            input.directory,
            file.fileName,
            problemIndex,
            rawProblem,
            questionIndex,
            rawQuestion,
          );

          const questionType = nonEmptyString(rawQuestion.type) ?? "UNKNOWN";
          const questionSkill =
            nonEmptyString(rawQuestion.skillType) ?? "UNKNOWN";
          const questionDifficulty =
            nonEmptyString(rawQuestion.difficulty) ?? "UNKNOWN";
          increment(report.byQuestionType, questionType);
          incrementCount(report.bySkill, questionSkill, "questions");
          incrementCount(
            report.byDifficulty,
            questionDifficulty,
            "questions",
          );

          const explanation = nonEmptyString(rawQuestion.explanation);
          if (!explanation) {
            report.findings.missingExplanations.push(questionLocation);
          } else if (explanation.length < SHORT_EXPLANATION_THRESHOLD) {
            report.findings.shortExplanations.push(questionLocation);
          }

          if (
            questionType === "WORD_FORMATION" &&
            !nonEmptyString(rawQuestion.rootWord)
          ) {
            report.findings.wordFormationWithoutRootWords.push(questionLocation);
          }
          if (
            questionType === "READING_MCQ" &&
            !problemHasReadingPassage
          ) {
            report.findings.readingQuestionsWithoutPassages.push(
              questionLocation,
            );
          }
          if (
            questionType === "TRIOS_GAPPED_SENTENCES" &&
            !hasThreeTriosSentences(rawQuestion)
          ) {
            report.findings.triosWithoutThreeSentences.push(questionLocation);
          }
          if (questionSkill !== problemSkill) {
            report.findings.skillMismatches.push(questionLocation);
          }
          if (questionDifficulty !== problemDifficulty) {
            report.findings.difficultyMismatches.push(questionLocation);
          }

          if (optionQuestionTypes.has(questionType)) {
            report.inventory.optionQuestions += 1;
            const options = Array.isArray(rawQuestion.options)
              ? rawQuestion.options
              : [];
            const identifiers = options.map((option) =>
              isRecord(option)
                ? canonicalScoringIdentifier(option.id)
                : undefined,
            );
            const correctOption = rendererAnswerIdentifier(
              questionType,
              rawQuestion.answer,
            );
            const correctIndex = correctOption
              ? identifiers.indexOf(correctOption)
              : -1;
            if (
              options.length < 2 ||
              identifiers.some((identifier) => !identifier) ||
              new Set(identifiers).size !== identifiers.length ||
              correctIndex < 0
            ) {
              report.findings.invalidCorrectOptions.push(questionLocation);
            } else {
              const position =
                correctIndex < 26
                  ? String.fromCharCode("A".charCodeAt(0) + correctIndex)
                  : String(correctIndex + 1);
              increment(report.answerPositions, position);
            }
          }

          if (optionRendererQuestionTypes.has(questionType)) {
            const rendererOptions =
              questionType === "ERROR_IDENTIFICATION"
                ? normalizeErrorIdentificationOptions(rawQuestion.options)
                : rawQuestion.options;
            const options = Array.isArray(rendererOptions)
              ? rendererOptions
              : [];
            const projectedOptions = options.map((option) => {
              if (!isRecord(option)) {
                return {
                  visibleId: null,
                  canonicalId: undefined,
                  visibleText: null,
                  displayText: undefined,
                  normalizedText: undefined,
                };
              }
              return {
                visibleId: safeVisibleValue(option.id),
                canonicalId: canonicalScoringIdentifier(option.id),
                visibleText: safeVisibleValue(option.text),
                displayText: learnerVisibleDisplayText(option.text),
                normalizedText: normalizedDisplayText(option.text),
              };
            });
            const renderableOptions = projectedOptions.filter(
              (option) => option.canonicalId,
            );
            const canonicalIdentifiers = renderableOptions.map(
              (option) => option.canonicalId!,
            );
            const expectedAnswer = rendererAnswerIdentifier(
              questionType,
              rawQuestion.answer,
            );
            const issues: RendererOptionIssue[] = [];
            if (questionType === "ERROR_IDENTIFICATION") {
              const contract = validateErrorIdentificationContract(
                rendererOptions,
                normalizeErrorIdentificationAnswer(rawQuestion.answer),
              );
              const contractCodes = new Set(
                contract.issues.map((contractIssue) => contractIssue.code),
              );
              if (
                contractCodes.has("OPTIONS_REQUIRED") ||
                contractCodes.has("OPTION_COUNT_NOT_FOUR")
              ) {
                issues.push("OPTION_COUNT_NOT_FOUR");
              }
              if (
                contractCodes.has("INVALID_OPTION_ID") ||
                contractCodes.has("MISSING_CANONICAL_OPTION_ID")
              ) {
                issues.push("INVALID_OPTION_ID");
              }
              if (contractCodes.has("DUPLICATE_OPTION_ID")) {
                issues.push("DUPLICATE_OPTION_ID");
              }
              if (contractCodes.has("INVALID_OPTION_TEXT")) {
                issues.push("INVALID_OPTION_TEXT");
              }
              if (
                contractCodes.has("CORRECT_PART_REQUIRED") ||
                contractCodes.has("CORRECT_PART_INVALID") ||
                contractCodes.has("CORRECT_PART_NOT_IN_OPTIONS")
              ) {
                issues.push("ANSWER_NOT_IN_RENDERED_OPTIONS");
              }
            } else {
              if (renderableOptions.length < 2) {
                issues.push("TOO_FEW_RENDERABLE_OPTIONS");
              }
              if (projectedOptions.some((option) => !option.canonicalId)) {
                issues.push("INVALID_OPTION_ID");
              }
              if (
                new Set(canonicalIdentifiers).size !==
                canonicalIdentifiers.length
              ) {
                issues.push("DUPLICATE_OPTION_ID");
              }
              if (
                renderableOptions.some((option) => !option.displayText)
              ) {
                issues.push("INVALID_OPTION_TEXT");
              }
              if (
                !expectedAnswer ||
                !canonicalIdentifiers.includes(expectedAnswer)
              ) {
                issues.push("ANSWER_NOT_IN_RENDERED_OPTIONS");
              }
            }
            if (issues.length > 0) {
              report.findings.rendererIncompatibleOptions.push(
                {
                  ...questionLocation,
                  issues,
                  optionIds: projectedOptions.map((option) => option.visibleId),
                  optionTexts: projectedOptions.map(
                    (option) => option.visibleText,
                  ),
                  selectedAnswer: safeVisibleValue(
                    rendererAnswerValue(questionType, rawQuestion.answer),
                  ),
                },
              );
            }

            const normalizedTextGroups = new Map<string, string[]>();
            renderableOptions.forEach((option) => {
              if (!option.normalizedText || option.visibleText === null) return;
              const values =
                normalizedTextGroups.get(option.normalizedText) ?? [];
              values.push(option.visibleText);
              normalizedTextGroups.set(option.normalizedText, values);
            });
            const duplicateGroups = [...normalizedTextGroups.entries()]
              .filter(([, values]) => values.length > 1)
              .sort(([left], [right]) => ordinalCompare(left, right));
            if (duplicateGroups.length > 0) {
              const reportedGroups = duplicateGroups.slice(
                0,
                MAX_OPTION_AMBIGUITY_GROUPS,
              );
              report.findings.duplicateNormalizedOptionTexts.push({
                ...questionLocation,
                questionType,
                duplicateGroupCount: duplicateGroups.length,
                groups: reportedGroups.map(([normalizedText, values]) => ({
                  normalizedTextKey: safeVisibleValue(normalizedText)!,
                  occurrences: values.length,
                  rawDisplayValues: values.slice(
                    0,
                    MAX_OPTION_AMBIGUITY_VALUES_PER_GROUP,
                  ),
                  omittedValues: Math.max(
                    0,
                    values.length -
                      MAX_OPTION_AMBIGUITY_VALUES_PER_GROUP,
                  ),
                })),
                omittedGroups: Math.max(
                  0,
                  duplicateGroups.length -
                    MAX_OPTION_AMBIGUITY_GROUPS,
                ),
              });
            }
          }

          const prompt = normalizedPrompt(rawQuestion.prompt);
          if (
            prompt.length >= 20 &&
            !genericPromptQuestionTypes.has(questionType)
          ) {
            const locations = duplicateCandidates.get(prompt) ?? [];
            locations.push(questionLocation);
            duplicateCandidates.set(prompt, locations);
          }
        });
      });

      if (entry) {
        addMismatch(
          report.manifestMismatches,
          input.directory,
          "problems",
          entry.problemCount,
          problems.length,
          file.fileName,
        );
        addMismatch(
          report.manifestMismatches,
          input.directory,
          "questions",
          entry.questionCount,
          fileQuestionCount,
          file.fileName,
        );
      }
    }

    if (hasManifest) {
      addMismatch(
        report.manifestMismatches,
        input.directory,
        "files",
        manifest.totals.files,
        packInventory.splitFiles,
      );
      addMismatch(
        report.manifestMismatches,
        input.directory,
        "problems",
        manifest.totals.problems,
        packInventory.problems,
      );
      addMismatch(
        report.manifestMismatches,
        input.directory,
        "questions",
        manifest.totals.questions,
        packInventory.questions,
      );
    }
    report.packs.push(packInventory);
  }

  report.findings = {
    problemsWithoutInstructions: sortedCopy(
      report.findings.problemsWithoutInstructions,
      compareAuditLocations,
    ),
    missingExplanations: sortedCopy(
      report.findings.missingExplanations,
      compareAuditLocations,
    ),
    shortExplanations: sortedCopy(
      report.findings.shortExplanations,
      compareAuditLocations,
    ),
    wordFormationWithoutRootWords: sortedCopy(
      report.findings.wordFormationWithoutRootWords,
      compareAuditLocations,
    ),
    readingQuestionsWithoutPassages: sortedCopy(
      report.findings.readingQuestionsWithoutPassages,
      compareAuditLocations,
    ),
    triosWithoutThreeSentences: sortedCopy(
      report.findings.triosWithoutThreeSentences,
      compareAuditLocations,
    ),
    skillMismatches: sortedCopy(
      report.findings.skillMismatches,
      compareAuditLocations,
    ),
    difficultyMismatches: sortedCopy(
      report.findings.difficultyMismatches,
      compareAuditLocations,
    ),
    invalidCorrectOptions: sortedCopy(
      report.findings.invalidCorrectOptions,
      compareAuditLocations,
    ),
    rendererIncompatibleOptions: sortedCopy(
      report.findings.rendererIncompatibleOptions,
      compareAuditLocations,
    ),
    duplicateNormalizedOptionTexts: sortedCopy(
      report.findings.duplicateNormalizedOptionTexts,
      compareAuditLocations,
    ),
    duplicatePromptGroups: [...duplicateCandidates.entries()]
      .filter(([, locations]) => locations.length > 1)
      .map(([normalizedDuplicatePrompt, locations]) => ({
        normalizedDuplicatePrompt,
        group: {
          occurrences: locations.length,
          locations: sortedCopy(locations, compareAuditLocations),
        },
      }))
      .sort(
        (left, right) =>
          ordinalCompare(
            left.normalizedDuplicatePrompt,
            right.normalizedDuplicatePrompt,
          ) ||
          compareAuditLocations(
            left.group.locations[0],
            right.group.locations[0],
          ),
      )
      .map(({ group }) => group),
  };

  report.bySkill = sortedCountRecord(report.bySkill);
  report.byQuestionType = sortedNumberRecord(report.byQuestionType);
  report.byDifficulty = sortedCountRecord(report.byDifficulty);
  report.answerPositions = sortedNumberRecord(report.answerPositions);
  report.packs = sortedCopy(report.packs, comparePackInventories);
  report.malformedInputs = sortedCopy(
    report.malformedInputs,
    compareManifestIssues,
  );
  report.normalizerWarnings = sortedCopy(
    report.normalizerWarnings,
    compareManifestIssues,
  );
  report.manifestMismatches = sortedCopy(
    report.manifestMismatches,
    compareManifestMismatches,
  );
  report.hasInventoryErrors =
    report.malformedInputs.length > 0 ||
    report.manifestMismatches.length > 0;
  return report;
}
