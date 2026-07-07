import type { Question, SubmissionStatus } from "@prisma/client";

type JsonObject = Record<string, unknown>;

export type QuestionCheckResult = {
  isCorrect: boolean | null;
  feedback: string;
  correctAnswer: string;
};

export function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”"'.?!,;:()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkExactMatch(studentAnswer: unknown, correctAnswer: unknown) {
  return normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswer);
}

export function checkMultipleAcceptedAnswers(studentAnswer: unknown, acceptedAnswers: unknown[]) {
  return acceptedAnswers.some((answer) => checkExactMatch(studentAnswer, answer));
}

export function checkMCQ(studentAnswer: unknown, correctOptionId: unknown) {
  return String(studentAnswer ?? "").trim().toUpperCase() === String(correctOptionId ?? "").trim().toUpperCase();
}

export function checkTextAnswer(studentAnswer: unknown, acceptedAnswers: unknown[]) {
  return checkMultipleAcceptedAnswers(studentAnswer, acceptedAnswers);
}

function asObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

function getAcceptedAnswers(answer: JsonObject) {
  const accepted = answer.acceptedAnswers;
  if (Array.isArray(accepted)) {
    return accepted;
  }

  const importedAccepted = answer.accepted;
  if (Array.isArray(importedAccepted)) {
    return importedAccepted;
  }

  if (typeof accepted === "string") {
    return [accepted];
  }

  if (typeof importedAccepted === "string") {
    return [importedAccepted];
  }

  const correctForm = answer.correctForm;
  if (typeof correctForm === "string") {
    return [correctForm];
  }

  return [];
}

export function summarizeCorrectAnswer(question: Pick<Question, "answer" | "type">) {
  const answer = asObject(question.answer);

  if (typeof answer.correctOptionId === "string") {
    return answer.correctOptionId;
  }

  if (typeof answer.correctPart === "string") {
    return `${answer.correctPart}${typeof answer.correction === "string" ? ` → ${answer.correction}` : ""}`;
  }

  if (typeof answer.modelAnswer === "string") {
    return answer.modelAnswer;
  }

  const acceptedAnswers = getAcceptedAnswers(answer);
  if (acceptedAnswers.length > 0) {
    return acceptedAnswers.join(" / ");
  }

  if (answer.needsReview) {
    return "Cần chấm tay";
  }

  return "—";
}

export function checkQuestionAnswer(
  question: Pick<Question, "type" | "answer" | "explanation">,
  studentAnswer: unknown,
): QuestionCheckResult {
  const answer = asObject(question.answer);
  const correctAnswer = summarizeCorrectAnswer(question as Pick<Question, "answer" | "type">);
  const explanation = question.explanation ?? "Không có giải thích cho câu này.";

  if (
    question.type === "MCQ" ||
    question.type === "GUIDED_CLOZE" ||
    question.type === "PRONUNCIATION_ODD_ONE_OUT" ||
    question.type === "READING_MCQ" ||
    question.type === "LISTENING_MCQ"
  ) {
    const isCorrect = checkMCQ(studentAnswer, answer.correctOptionId);
    return {
      isCorrect,
      feedback: isCorrect ? `Chính xác. ${explanation}` : `Chưa đúng. Đáp án đúng là ${correctAnswer}. ${explanation}`,
      correctAnswer,
    };
  }

  if (
    question.type === "OPEN_CLOZE" ||
    question.type === "WORD_FORMATION" ||
    question.type === "TRIOS_GAPPED_SENTENCES" ||
    question.type === "SHORT_ANSWER" ||
    question.type === "LISTENING_SHORT_ANSWER"
  ) {
    const acceptedAnswers = getAcceptedAnswers(answer);
    const isCorrect = checkTextAnswer(studentAnswer, acceptedAnswers);
    return {
      isCorrect,
      feedback: isCorrect ? `Chính xác. ${explanation}` : `Chưa đúng. Đáp án chấp nhận: ${correctAnswer}. ${explanation}`,
      correctAnswer,
    };
  }

  if (question.type === "SENTENCE_TRANSFORMATION") {
    const acceptedAnswers = getAcceptedAnswers(answer);
    const isExact = checkTextAnswer(studentAnswer, acceptedAnswers);
    return {
      isCorrect: isExact ? true : null,
      feedback: isExact
        ? `Chính xác. ${explanation}`
        : `Cần người chấm kiểm tra vì câu viết lại có thể có biến thể hợp lệ. Đáp án mẫu: ${correctAnswer}.`,
      correctAnswer,
    };
  }

  if (question.type === "ERROR_IDENTIFICATION") {
    const response = asObject(studentAnswer);
    const selectedPart = response.part;
    const correction = response.correction;
    const correctionText = typeof answer.correction === "string" ? answer.correction : "";
    const acceptedCorrections = correctionText
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
    const partCorrect = checkMCQ(selectedPart, answer.correctPart);
    const correctionCorrect =
      acceptedCorrections.length === 0 || checkMultipleAcceptedAnswers(correction, acceptedCorrections);
    const isCorrect = partCorrect && correctionCorrect;

    return {
      isCorrect,
      feedback: isCorrect
        ? `Chính xác. ${explanation}`
        : `Chưa đúng. Lỗi nằm ở ${answer.correctPart}; sửa thành: ${correctionText}. ${explanation}`,
      correctAnswer,
    };
  }

  if (question.type === "WRITING_PROMPT") {
    return {
      isCorrect: null,
      feedback: "Bài viết đã được lưu và cần chấm tay theo rubric.",
      correctAnswer,
    };
  }

  return {
    isCorrect: null,
    feedback: "Dạng câu hỏi này cần được kiểm tra thủ công.",
    correctAnswer,
  };
}

export function getSubmissionStatus(results: Array<{ isCorrect: boolean | null }>): SubmissionStatus {
  if (results.length === 0 || results.some((result) => result.isCorrect === null)) {
    return "NEEDS_REVIEW";
  }

  const correctCount = results.filter((result) => result.isCorrect).length;

  if (correctCount === results.length) {
    return "ACCEPTED";
  }

  if (correctCount === 0) {
    return "WRONG_ANSWER";
  }

  return "PARTIAL";
}

export function getProblemStatusFromSubmission(status: SubmissionStatus) {
  if (status === "ACCEPTED") {
    return "SOLVED" as const;
  }

  if (status === "NEEDS_REVIEW") {
    return "NEEDS_REVIEW" as const;
  }

  if (status === "WRONG_ANSWER") {
    return "WRONG" as const;
  }

  return "ATTEMPTED" as const;
}
