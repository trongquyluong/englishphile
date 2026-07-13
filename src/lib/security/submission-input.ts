type FormEntry = readonly [string, FormDataEntryValue];

export function parseDiagnosticAnswerEntries(
  entries: Iterable<FormEntry>,
): Record<string, unknown> {
  const answers = Object.create(null) as Record<string, unknown>;

  for (const [key, value] of entries) {
    if (!key.startsWith("answer:")) continue;
    const [, questionId, field] = key.split(":");
    if (!questionId) continue;
    if (!field) {
      answers[questionId] = String(value);
      continue;
    }

    const current = answers[questionId];
    const objectAnswer = current && typeof current === "object" && !Array.isArray(current)
      ? current as Record<string, unknown>
      : Object.create(null) as Record<string, unknown>;
    objectAnswer[field] = String(value);
    answers[questionId] = objectAnswer;
  }

  return answers;
}

export function parseContestAnswerEntries(
  entries: Iterable<FormEntry>,
  allowed: {
    problemQuestions: ReadonlyMap<string, ReadonlySet<string>>;
    sectionQuestions: ReadonlyMap<string, ReadonlySet<string>>;
  },
): {
  answersByProblem: Record<string, Record<string, unknown>>;
  answersBySection: Record<string, Record<string, unknown>>;
} {
  const answersByProblem = Object.create(null) as Record<string, Record<string, unknown>>;
  const answersBySection = Object.create(null) as Record<string, Record<string, unknown>>;

  for (const [key, value] of entries) {
    const parts = key.split(":");
    if (key.startsWith("sectionAnswer:")) {
      const [, sectionId, questionId] = parts;
      if (!sectionId || !questionId || !allowed.sectionQuestions.get(sectionId)?.has(questionId)) continue;
      answersBySection[sectionId] ??= Object.create(null) as Record<string, unknown>;
      answersBySection[sectionId][questionId] = String(value);
      continue;
    }

    if (key.startsWith("answer:")) {
      const [, problemId, questionId] = parts;
      if (!problemId || !questionId || !allowed.problemQuestions.get(problemId)?.has(questionId)) continue;
      answersByProblem[problemId] ??= Object.create(null) as Record<string, unknown>;
      answersByProblem[problemId][questionId] = String(value);
    }
  }

  return { answersByProblem, answersBySection };
}
