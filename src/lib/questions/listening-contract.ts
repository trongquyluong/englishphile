

export const LISTENING_MCQ_OPTION_IDS = ["A", "B", "C", "D"] as const;

export type ListeningContractIssueCode =
  | "LISTENING_PROMPT_REQUIRED"
  | "LISTENING_MCQ_OPTIONS_REQUIRED"
  | "LISTENING_MCQ_OPTION_COUNT_INVALID"
  | "LISTENING_MCQ_OPTION_ID_INVALID"
  | "LISTENING_MCQ_OPTION_ID_DUPLICATE"
  | "LISTENING_MCQ_OPTION_TEXT_INVALID"
  | "LISTENING_MCQ_CORRECT_OPTION_REQUIRED"
  | "LISTENING_MCQ_CORRECT_OPTION_NOT_IN_OPTIONS"
  | "LISTENING_SHORT_ACCEPTED_REQUIRED"
  | "LISTENING_SHORT_ACCEPTED_INVALID"
  | "LISTENING_SHORT_ACCEPTED_TOO_MANY"
  | "LISTENING_SHORT_ACCEPTED_TOO_LONG"
  | "LISTENING_SHORT_ACCEPTED_DUPLICATE"
  | "LISTENING_DESCRIPTOR_REQUIRED"
  | "LISTENING_VERSION_UNSUPPORTED"
  | "LISTENING_AUDIO_REQUIRED"
  | "LISTENING_ASSET_REF_INVALID"
  | "LISTENING_MIME_UNSUPPORTED"
  | "LISTENING_BYTE_LENGTH_INVALID"
  | "LISTENING_DURATION_INVALID"
  | "LISTENING_UNAVAILABLE_BEHAVIOR_INVALID"
  | "LISTENING_PART_LABEL_INVALID"
  | "LISTENING_TRANSCRIPT_REQUIRED"
  | "LISTENING_TRANSCRIPT_TEXT_INVALID"
  | "LISTENING_TRANSCRIPT_LANGUAGE_INVALID"
  | "LISTENING_TRANSCRIPT_POLICY_INVALID"
  | "LISTENING_ATTRIBUTION_REQUIRED"
  | "LISTENING_ATTRIBUTION_INVALID"
  | "LISTENING_RIGHTS_CLASSIFICATION_REQUIRED"
  | "LISTENING_RIGHTS_EVIDENCE_REQUIRED"
  | "LISTENING_RIGHTS_EVIDENCE_INVALID";

export type ListeningContractIssue = {
  code: ListeningContractIssueCode;
  path: string;
  message: string;
  importLevel: "error" | "warning";
};

export type ListeningContractResult = {
  valid: boolean;
  issues: ListeningContractIssue[];
};

function issue(
  code: ListeningContractIssueCode,
  path: string,
  message: string,
  importLevel: "error" | "warning",
): ListeningContractIssue {
  return { code, path, message, importLevel };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function visiblePrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

export function validateListeningMetadata(metadata: unknown): ListeningContractIssue[] {
  const issues: ListeningContractIssue[] = [];

  if (!isRecord(metadata) || !isRecord(metadata.listening)) {
    return [issue("LISTENING_DESCRIPTOR_REQUIRED", "metadata.listening", "Listening cần metadata.listening object hoàn chỉnh.", "warning")];
  }

  const listening = metadata.listening;

  if (listening.version !== 1) {
    issues.push(issue("LISTENING_VERSION_UNSUPPORTED", "metadata.listening.version", "metadata.listening.version phải là 1.", "warning"));
  }

  if (listening.partLabel !== undefined) {
    if (typeof listening.partLabel !== "string" || listening.partLabel.trim().length === 0 || listening.partLabel.trim().length > 80) {
      issues.push(issue("LISTENING_PART_LABEL_INVALID", "metadata.listening.partLabel", "partLabel nếu có phải là chuỗi từ 1-80 ký tự.", "warning"));
    }
  }

  if (!isRecord(listening.audio)) {
    issues.push(issue("LISTENING_AUDIO_REQUIRED", "metadata.listening.audio", "Cần metadata.listening.audio object.", "warning"));
  } else {
    const audio = listening.audio;
    if (
      typeof audio.assetRef !== "string" ||
      audio.assetRef.length < 1 ||
      audio.assetRef.length > 240 ||
      !audio.assetRef.startsWith("/media/listening/") ||
      audio.assetRef.includes("?") ||
      audio.assetRef.includes("#") ||
      audio.assetRef.includes("\\") ||
      audio.assetRef.includes("..") ||
      audio.assetRef.includes("://") ||
      /[\x00-\x1F\x7F-\x9F]/.test(audio.assetRef)
    ) {
      issues.push(issue("LISTENING_ASSET_REF_INVALID", "metadata.listening.audio.assetRef", "assetRef không hợp lệ.", "warning"));
    }
    if (audio.mimeType !== "audio/mpeg") {
      issues.push(issue("LISTENING_MIME_UNSUPPORTED", "metadata.listening.audio.mimeType", "Chỉ hỗ trợ mimeType audio/mpeg trong pilot.", "warning"));
    }
    if (typeof audio.byteLength !== "number" || !Number.isSafeInteger(audio.byteLength) || audio.byteLength < 1 || audio.byteLength > 15728640) {
      issues.push(issue("LISTENING_BYTE_LENGTH_INVALID", "metadata.listening.audio.byteLength", "byteLength phải từ 1 đến 15MB.", "warning"));
    }
    if (typeof audio.durationMs !== "number" || !Number.isSafeInteger(audio.durationMs) || audio.durationMs < 5000 || audio.durationMs > 900000) {
      issues.push(issue("LISTENING_DURATION_INVALID", "metadata.listening.audio.durationMs", "durationMs phải từ 5000 đến 900000.", "warning"));
    }
  }

  if (!isRecord(listening.transcript)) {
    issues.push(issue("LISTENING_TRANSCRIPT_REQUIRED", "metadata.listening.transcript", "Cần metadata.listening.transcript object cho ấn bản.", "warning"));
  } else {
    const transcript = listening.transcript;
    if (typeof transcript.text !== "string" || transcript.text.trim().length < 1 || transcript.text.trim().length > 20000 || /[\x00-\x09\x0B-\x1F\x7F-\x9F]/.test(transcript.text)) {
      issues.push(issue("LISTENING_TRANSCRIPT_TEXT_INVALID", "metadata.listening.transcript.text", "Transcript text không hợp lệ (1-20000 ký tự).", "warning"));
    }
    if (typeof transcript.languageTag !== "string" || transcript.languageTag.length < 2 || transcript.languageTag.length > 35) {
      issues.push(issue("LISTENING_TRANSCRIPT_LANGUAGE_INVALID", "metadata.listening.transcript.languageTag", "languageTag không hợp lệ (BCP-47).", "warning"));
    }
    if (transcript.availabilityPolicy !== "AFTER_SUBMISSION") {
      issues.push(issue("LISTENING_TRANSCRIPT_POLICY_INVALID", "metadata.listening.transcript.availabilityPolicy", "availabilityPolicy phải là AFTER_SUBMISSION.", "warning"));
    }
  }

  if (!isRecord(listening.attribution)) {
    issues.push(issue("LISTENING_ATTRIBUTION_REQUIRED", "metadata.listening.attribution", "Cần metadata.listening.attribution object.", "warning"));
  } else {
    const attribution = listening.attribution;
    if (typeof attribution.displayText !== "string" || attribution.displayText.trim().length < 1 || attribution.displayText.trim().length > 240 || attribution.displayText.includes("<")) {
      issues.push(issue("LISTENING_ATTRIBUTION_INVALID", "metadata.listening.attribution.displayText", "displayText không hợp lệ (1-240 ký tự, không HTML).", "warning"));
    }
  }

  if (!isRecord(listening.rights)) {
    issues.push(issue("LISTENING_RIGHTS_CLASSIFICATION_REQUIRED", "metadata.listening.rights", "Cần metadata.listening.rights object.", "warning"));
  } else {
    const rights = listening.rights;
    if (typeof rights.classification !== "string" || !rights.classification) {
      issues.push(issue("LISTENING_RIGHTS_CLASSIFICATION_REQUIRED", "metadata.listening.rights.classification", "classification là bắt buộc.", "warning"));
    }
    if (typeof rights.evidenceRef !== "string" || rights.evidenceRef.trim().length < 1 || rights.evidenceRef.trim().length > 200 || rights.evidenceRef.includes("?") || rights.evidenceRef.includes("#")) {
      issues.push(issue("LISTENING_RIGHTS_EVIDENCE_INVALID", "metadata.listening.rights.evidenceRef", "evidenceRef không hợp lệ (1-200 ký tự, không query/fragment).", "warning"));
    }
  }

  if (listening.unavailableBehavior !== "BLOCK_PROBLEM") {
    issues.push(issue("LISTENING_UNAVAILABLE_BEHAVIOR_INVALID", "metadata.listening.unavailableBehavior", "unavailableBehavior phải là BLOCK_PROBLEM.", "warning"));
  }

  return issues;
}

export function validateListeningMCQContract(
  optionsValue: unknown,
  answerValue: unknown,
  metadataValue: unknown,
  promptValue?: string,
): ListeningContractResult {
  const issues: ListeningContractIssue[] = [];

  if (typeof promptValue === "string" && promptValue.trim().length === 0) {
    issues.push(issue("LISTENING_PROMPT_REQUIRED", "prompt", "LISTENING_MCQ cần prompt.", "error"));
  }

  issues.push(...validateListeningMetadata(metadataValue));

  const canonicalOptionIds: string[] = [];

  if (!Array.isArray(optionsValue) || optionsValue.length === 0) {
    issues.push(issue("LISTENING_MCQ_OPTIONS_REQUIRED", "options", "LISTENING_MCQ cần options.", "error"));
  } else {
    if (optionsValue.length !== 3 && optionsValue.length !== 4) {
      issues.push(issue("LISTENING_MCQ_OPTION_COUNT_INVALID", "options", "LISTENING_MCQ cần đúng 3 hoặc 4 options.", "error"));
    }

    optionsValue.forEach((rawOption, index) => {
      const option = isRecord(rawOption) ? rawOption : {};
      const canonicalId = visiblePrimitive(option.id)?.trim().toUpperCase() || null;
      const rawText = visiblePrimitive(option.text);

      if (!canonicalId || !(LISTENING_MCQ_OPTION_IDS as readonly string[]).includes(canonicalId)) {
        issues.push(issue("LISTENING_MCQ_OPTION_ID_INVALID", `options.${index}.id`, "Mã phần phải là A, B, C hoặc D.", "error"));
      } else {
        if (canonicalOptionIds.includes(canonicalId)) {
          issues.push(issue("LISTENING_MCQ_OPTION_ID_DUPLICATE", `options.${index}.id`, "Mỗi mã phần chỉ được xuất hiện một lần.", "error"));
        } else {
          canonicalOptionIds.push(canonicalId);
        }
      }

      if (rawText === null || !rawText.trim() || rawText.trim().length > 500) {
        issues.push(issue("LISTENING_MCQ_OPTION_TEXT_INVALID", `options.${index}.text`, "Nội dung hiển thị phải từ 1-500 ký tự.", "error"));
      }
    });
  }

  const answer = isRecord(answerValue) ? answerValue : {};
  const correctOptionId = visiblePrimitive(answer.correctOptionId)?.trim().toUpperCase();

  if (!correctOptionId) {
    issues.push(issue("LISTENING_MCQ_CORRECT_OPTION_REQUIRED", "answer.correctOptionId", "LISTENING_MCQ cần correctOptionId.", "error"));
  } else if (!canonicalOptionIds.includes(correctOptionId)) {
    issues.push(issue("LISTENING_MCQ_CORRECT_OPTION_NOT_IN_OPTIONS", "answer.correctOptionId", "correctOptionId phải thuộc các options đã khai báo.", "error"));
  }

  return {
    valid: !issues.some((i) => i.importLevel === "error"),
    issues,
  };
}

export function validateListeningShortAnswerContract(
  answerValue: unknown,
  metadataValue: unknown,
  promptValue?: string,
): ListeningContractResult {
  const issues: ListeningContractIssue[] = [];

  if (typeof promptValue === "string" && promptValue.trim().length === 0) {
    issues.push(issue("LISTENING_PROMPT_REQUIRED", "prompt", "LISTENING_SHORT_ANSWER cần prompt.", "error"));
  }

  issues.push(...validateListeningMetadata(metadataValue));

  const answer = isRecord(answerValue) ? answerValue : {};
  const acceptedAnswers = Array.isArray(answer.acceptedAnswers) ? answer.acceptedAnswers.map((v) => visiblePrimitive(v)?.trim() || "") : [];

  if (acceptedAnswers.length === 0 || acceptedAnswers.every((a) => a.length === 0)) {
    issues.push(issue("LISTENING_SHORT_ACCEPTED_REQUIRED", "answer.acceptedAnswers", "LISTENING_SHORT_ANSWER cần ít nhất một acceptedAnswers không rỗng.", "error"));
  } else {
    if (acceptedAnswers.length > 8) {
      issues.push(issue("LISTENING_SHORT_ACCEPTED_TOO_MANY", "answer.acceptedAnswers", "LISTENING_SHORT_ANSWER tối đa 8 acceptedAnswers.", "error"));
    }

    const uniqueAnswers = new Set<string>();
    acceptedAnswers.forEach((ans, index) => {
      if (ans.length === 0) {
        issues.push(issue("LISTENING_SHORT_ACCEPTED_INVALID", `answer.acceptedAnswers.${index}`, "Accepted answer không được rỗng.", "error"));
      } else if (ans.length > 120) {
        issues.push(issue("LISTENING_SHORT_ACCEPTED_TOO_LONG", `answer.acceptedAnswers.${index}`, "Mỗi accepted answer tối đa 120 ký tự.", "error"));
      } else {
        if (uniqueAnswers.has(ans)) {
          issues.push(issue("LISTENING_SHORT_ACCEPTED_DUPLICATE", `answer.acceptedAnswers.${index}`, "Các accepted answer không được trùng lặp.", "error"));
        } else {
          uniqueAnswers.add(ans);
        }
      }
    });
  }

  return {
    valid: !issues.some((i) => i.importLevel === "error"),
    issues,
  };
}

export type ListeningPresentationDTO =
  | {
      state: "UNAVAILABLE";
      reason: "DELIVERY_NOT_CONFIGURED";
      mimeType: "audio/mpeg";
      durationMs: number;
      partLabel: string | null;
      attributionText: string;
      transcriptPolicy: "AFTER_SUBMISSION";
      transcript: null;
    }
  | {
      state: "UNAVAILABLE";
      messageCode: "LISTENING_MEDIA_UNAVAILABLE";
    };

export function projectListeningPresentation(
  metadataValue: unknown,
  optionsValue: unknown,
  questionType: string,
): ListeningPresentationDTO | null {
  if (
    questionType !== "LISTENING_MCQ" &&
    questionType !== "LISTENING_SHORT_ANSWER"
  ) {
    return null;
  }

  const metadataIssues = validateListeningMetadata(metadataValue);
  const metadataValid = !metadataIssues.some(
    (i) => i.importLevel === "error" || i.importLevel === "warning"
  );

  if (!metadataValid) {
    return null;
  }

  if (questionType === "LISTENING_MCQ") {
    if (!Array.isArray(optionsValue) || (optionsValue.length !== 3 && optionsValue.length !== 4)) {
      return null;
    }

    const canonicalOptionIds: string[] = [];
    for (const rawOption of optionsValue) {
      const option = isRecord(rawOption) ? rawOption : {};
      const canonicalId = visiblePrimitive(option.id)?.trim().toUpperCase() || null;
      const rawText = visiblePrimitive(option.text);

      if (!canonicalId || !(LISTENING_MCQ_OPTION_IDS as readonly string[]).includes(canonicalId)) {
        return null;
      }
      if (canonicalOptionIds.includes(canonicalId)) {
        return null;
      }
      canonicalOptionIds.push(canonicalId);

      if (rawText === null || !rawText.trim() || rawText.trim().length > 500) {
        return null;
      }
    }
  }

  const metadata = metadataValue as Record<string, unknown>;
  const listening = metadata.listening as Record<string, unknown>;

  return {
    state: "UNAVAILABLE",
    reason: "DELIVERY_NOT_CONFIGURED",
    mimeType: "audio/mpeg",
    durationMs: Number((listening.audio as Record<string, unknown>).durationMs),
    partLabel: typeof listening.partLabel === "string" ? listening.partLabel.trim() : null,
    attributionText: String((listening.attribution as Record<string, unknown>).displayText).trim(),
    transcriptPolicy: "AFTER_SUBMISSION",
    transcript: null,
  };
}
