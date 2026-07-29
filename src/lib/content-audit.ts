export const SHORT_EXPLANATION_THRESHOLD = 45;

const optionQuestionTypes = new Set([
  "PRONUNCIATION_ODD_ONE_OUT",
  "MCQ",
  "GUIDED_CLOZE",
  "READING_MCQ",
  "LISTENING_MCQ",
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
    duplicatePromptGroups: DuplicatePromptGroup[];
  };
  manifestMismatches: ManifestMismatch[];
  malformedInputs: ManifestIssue[];
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

function sortedNumberRecord(record: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function sortedCountRecord(record: Record<string, AuditCount>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function isSafeSplitJsonFileName(fileName: string) {
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName === "." ||
    fileName === ".." ||
    fileName.includes("\0")
  ) {
    return false;
  }

  const normalized = fileName.toLowerCase();
  return (
    normalized.endsWith(".json") &&
    normalized !== "manifest.json" &&
    !normalized.startsWith("00-all-in-one")
  );
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
      nonEmptyString(rawEntry.fileName) ?? nonEmptyString(rawEntry.file);
    if (!fileName) {
      issues.push({
        path,
        message: "Manifest file entry needs fileName or file.",
      });
      return;
    }
    if (!isSafeSplitJsonFileName(fileName)) {
      issues.push({
        fileName,
        path,
        message: "Manifest entry is not a safe supported split JSON file.",
      });
      return;
    }

    const normalizedFileName = fileName.toLowerCase();
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

function optionIdentifier(option: unknown) {
  if (!isRecord(option)) return undefined;
  return nonEmptyString(option.id) ?? nonEmptyString(option.label);
}

function correctOptionIdentifier(answer: unknown) {
  if (!isRecord(answer)) return undefined;
  return (
    nonEmptyString(answer.correctOptionId) ??
    nonEmptyString(answer.correctOption)
  );
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

function locationFor(
  packDirectory: string,
  fileName: string,
  problemIndex: number,
  problem: Record<string, unknown>,
  questionIndex?: number,
): AuditLocation {
  return {
    packDirectory,
    fileName,
    problemIndex,
    ...(nonEmptyString(problem.slug)
      ? { problemSlug: nonEmptyString(problem.slug) }
      : {}),
    ...(questionIndex === undefined ? {} : { questionIndex }),
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
      duplicatePromptGroups: [],
    },
    manifestMismatches: [],
    malformedInputs: [],
    hasInventoryErrors: false,
  };

  const duplicateCandidates = new Map<string, AuditLocation[]>();

  for (const input of inputs) {
    const manifest = parseContentPackManifest(input.manifest);
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

    const providedFiles = new Map(
      input.files.map((file) => [file.fileName.toLowerCase(), file]),
    );
    const packInventory: ContentPackInventory = {
      directory: input.directory,
      name: manifest.name,
      splitFiles: manifest.entries.length,
      problems: 0,
      questions: 0,
    };

    report.inventory.splitFiles += manifest.entries.length;

    for (const entry of manifest.entries) {
      const file = providedFiles.get(entry.fileName.toLowerCase());
      if (!file) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: entry.fileName,
          path: "file",
          message: "Manifest-listed split file was not provided.",
        });
        continue;
      }
      if (file.parseError) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: entry.fileName,
          path: "file",
          message: file.parseError,
        });
        continue;
      }
      if (!isRecord(file.payload) || !Array.isArray(file.payload.problems)) {
        report.malformedInputs.push({
          packDirectory: input.directory,
          fileName: entry.fileName,
          path: "payload.problems",
          message: "Split-file payload must be an object with a problems array.",
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
            fileName: entry.fileName,
            path: `problems.${problemIndex}`,
            message: "Problem must be an object.",
          });
          return;
        }

        const problemLocation = locationFor(
          input.directory,
          entry.fileName,
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
            fileName: entry.fileName,
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
          const questionLocation = locationFor(
            input.directory,
            entry.fileName,
            problemIndex,
            rawProblem,
            questionIndex,
          );
          if (!isRecord(rawQuestion)) {
            report.malformedInputs.push({
              packDirectory: input.directory,
              fileName: entry.fileName,
              path: `problems.${problemIndex}.questions.${questionIndex}`,
              message: "Question must be an object.",
            });
            return;
          }

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
            const identifiers = options.map(optionIdentifier);
            const correctOption = correctOptionIdentifier(rawQuestion.answer);
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

      addMismatch(
        report.manifestMismatches,
        input.directory,
        "problems",
        entry.problemCount,
        problems.length,
        entry.fileName,
      );
      addMismatch(
        report.manifestMismatches,
        input.directory,
        "questions",
        entry.questionCount,
        fileQuestionCount,
        entry.fileName,
      );
    }

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
    report.packs.push(packInventory);
  }

  report.findings.duplicatePromptGroups = [...duplicateCandidates.values()]
    .filter((locations) => locations.length > 1)
    .map((locations) => ({
      occurrences: locations.length,
      locations,
    }))
    .sort((left, right) => {
      const countDifference = right.occurrences - left.occurrences;
      if (countDifference) return countDifference;
      const leftLocation = left.locations[0];
      const rightLocation = right.locations[0];
      return `${leftLocation.packDirectory}/${leftLocation.fileName}/${leftLocation.problemIndex}/${leftLocation.questionIndex}`.localeCompare(
        `${rightLocation.packDirectory}/${rightLocation.fileName}/${rightLocation.problemIndex}/${rightLocation.questionIndex}`,
      );
    });

  report.bySkill = sortedCountRecord(report.bySkill);
  report.byQuestionType = sortedNumberRecord(report.byQuestionType);
  report.byDifficulty = sortedCountRecord(report.byDifficulty);
  report.answerPositions = sortedNumberRecord(report.answerPositions);
  report.hasInventoryErrors =
    report.malformedInputs.length > 0 ||
    report.manifestMismatches.length > 0;
  return report;
}
