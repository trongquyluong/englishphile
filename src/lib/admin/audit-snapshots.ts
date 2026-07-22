type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function changedFields(before: RecordValue, after: RecordValue, fields: readonly string[]) {
  return [...new Set(fields)]
    .slice(0, 32)
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

function pair(beforeValue: unknown, afterValue: unknown, fields: readonly string[], mapper: (value: RecordValue) => RecordValue) {
  const before = record(beforeValue);
  const after = record(afterValue);
  const changes = changedFields(before, after, fields);
  return { beforeJson: mapper(before), afterJson: { ...mapper(after), changedFields: changes } };
}

const questionFields = ["type", "skillType", "difficulty", "prompt", "passage", "options", "answer", "explanation", "rootWord", "keyword", "targetSentence", "lineNumber", "metadata", "orderIndex", "contentStatus", "reviewedAt", "reviewedById"] as const;
export function questionAuditSnapshots(before: unknown, after: unknown) {
  return pair(before, after, questionFields, (item) => ({
    id: item.id,
    problemId: item.problemId,
    type: item.type,
    skillType: item.skillType,
    difficulty: item.difficulty,
    orderIndex: item.orderIndex,
    contentStatus: item.contentStatus,
    reviewedAt: item.reviewedAt,
    reviewedById: item.reviewedById,
    updatedAt: item.updatedAt,
  }));
}

const problemFields = ["title", "slug", "statement", "instructions", "skillType", "questionType", "difficulty", "estimatedMinutes", "sourceCollectionId", "contentStatus", "publishedAt", "reviewedAt", "reviewedById", "problemTopics"] as const;
export function problemAuditSnapshots(before: unknown, after: unknown) {
  return pair(before, after, problemFields, (item) => ({
    id: item.id,
    skillType: item.skillType,
    questionType: item.questionType,
    difficulty: item.difficulty,
    sourceCollectionId: item.sourceCollectionId,
    contentStatus: item.contentStatus,
    publishedAt: item.publishedAt,
    reviewedAt: item.reviewedAt,
    reviewedById: item.reviewedById,
    topicIds: Array.isArray(item.problemTopics)
      ? item.problemTopics.flatMap((relation) => typeof record(relation).topicId === "string" ? [record(relation).topicId] : []).slice(0, 20)
      : [],
    updatedAt: item.updatedAt,
  }));
}

export function topicAuditSnapshots(before: unknown, after: unknown) {
  return pair(before, after, ["name", "slug", "description", "parentId"], (item) => ({ id: item.id, parentId: item.parentId, updatedAt: item.updatedAt }));
}

export function sourceAuditSnapshots(before: unknown, after: unknown) {
  return pair(before, after, ["name", "description", "originalFileName", "sourceType", "copyrightNote"], (item) => ({ id: item.id, sourceType: item.sourceType, updatedAt: item.updatedAt }));
}

export function contentPackAuditSnapshots(before: unknown, after: unknown) {
  return pair(before, after, ["status"], (item) => ({ id: item.id, status: item.status, importedById: item.importedById, updatedAt: item.updatedAt }));
}
