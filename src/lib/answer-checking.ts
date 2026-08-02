import type { Question, SubmissionStatus } from "@prisma/client";
import {
  canonicalizeErrorIdentificationPart,
  ERROR_IDENTIFICATION_CORRECTION_LIMITS,
  isErrorIdentificationPartId,
  parseErrorIdentificationCorrectionVariants,
} from "@/lib/questions/error-identification-contract";
import { validateTriosAnswer } from "@/lib/questions/trios-contract";
import {
  canonicalizePronunciationOptionId,
  isPronunciationOptionId,
  validatePronunciationContract,
} from "@/lib/questions/pronunciation-contract";

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
    .replace(/[\u0027\u2018\u2019“”".?!,;:()[\]{}]/g, "")
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
  question: Pick<Question, "type" | "answer" | "explanation"> & {
    options?: unknown;
  },
  studentAnswer: unknown,
): QuestionCheckResult {
  const answer = asObject(question.answer);
  const correctAnswer = summarizeCorrectAnswer(question as Pick<Question, "answer" | "type">);
  const explanation = question.explanation ?? "Không có giải thích cho câu này.";

  if (
    question.type === "MCQ" ||
    question.type === "GUIDED_CLOZE" ||
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

  if (question.type === "PRONUNCIATION_ODD_ONE_OUT") {
    const contract = validatePronunciationContract(
      question.options,
      question.answer,
    );
    const learnerOptionId = canonicalizePronunciationOptionId(studentAnswer);
    const isCorrect =
      contract.valid &&
      Boolean(contract.correctOptionId) &&
      isPronunciationOptionId(learnerOptionId) &&
      learnerOptionId === contract.correctOptionId;
    const pronunciationCorrectAnswer = contract.correctOptionId ?? "—";
    return {
      isCorrect,
      feedback: isCorrect
        ? `Chính xác. ${explanation}`
        : `Chưa đúng. Đáp án đúng là ${pronunciationCorrectAnswer}. ${explanation}`,
      correctAnswer: pronunciationCorrectAnswer,
    };
  }

  if (
    question.type === "OPEN_CLOZE" ||
    question.type === "WORD_FORMATION" ||
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

  if (question.type === "TRIOS_GAPPED_SENTENCES") {
    const contract = validateTriosAnswer(answer);
    const learnerAnswer =
      typeof studentAnswer === "string" ? studentAnswer.trim() : "";
    const isCorrect =
      contract.valid &&
      Boolean(contract.sharedAnswer) &&
      Boolean(learnerAnswer) &&
      checkExactMatch(learnerAnswer, contract.sharedAnswer);
    const triosCorrectAnswer = contract.sharedAnswer ?? "—";
    return {
      isCorrect,
      feedback: isCorrect
        ? `Chính xác. ${explanation}`
        : `Chưa đúng. Đáp án chấp nhận: ${triosCorrectAnswer}. ${explanation}`,
      correctAnswer: triosCorrectAnswer,
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
    const rawCorrectionVariants = parseErrorIdentificationCorrectionVariants(
      correctionText,
    );
    const acceptedCorrections = rawCorrectionVariants.filter(Boolean);
    const correctionContractValid =
      Boolean(correctionText.trim()) &&
      correctionText.length <= ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxTotalLength &&
      rawCorrectionVariants.length <= ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariants &&
      rawCorrectionVariants.every(
        (variant) =>
          Boolean(variant) &&
          variant.length <= ERROR_IDENTIFICATION_CORRECTION_LIMITS.maxVariantLength,
      );
    const submittedPart = canonicalizeErrorIdentificationPart(selectedPart);
    const expectedPart = canonicalizeErrorIdentificationPart(answer.correctPart);
    const partCorrect =
      isErrorIdentificationPartId(submittedPart) &&
      isErrorIdentificationPartId(expectedPart) &&
      submittedPart === expectedPart;
    const correctionCorrect =
      correctionContractValid &&
      typeof correction === "string" &&
      Boolean(correction.trim()) &&
      checkMultipleAcceptedAnswers(correction, acceptedCorrections);
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
