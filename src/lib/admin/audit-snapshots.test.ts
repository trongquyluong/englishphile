import { describe, expect, it } from "vitest";
import { contentPackAuditSnapshots, problemAuditSnapshots, questionAuditSnapshots, sourceAuditSnapshots, topicAuditSnapshots } from "@/lib/admin/audit-snapshots";

describe("minimized content audit snapshots", () => {
  it("keeps operational identifiers while excluding sensitive content values recursively", () => {
    const before = { id: "q1", problemId: "p1", type: "MCQ", skillType: "MULTIPLE_CHOICE", difficulty: "B2", contentStatus: "DRAFT", prompt: "PROMPT_SENTINEL", answer: { correctAnswer: "CANONICAL_SENTINEL" }, explanation: "EXPLANATION_SENTINEL", options: ["OPTION_SENTINEL"] };
    const snapshots = questionAuditSnapshots(before, { ...before, prompt: "NEW_PROMPT_SENTINEL", contentStatus: "PUBLISHED" });
    expect(snapshots.afterJson).toEqual(expect.objectContaining({ id: "q1", problemId: "p1", contentStatus: "PUBLISHED", changedFields: expect.arrayContaining(["prompt", "contentStatus"]) }));
    expect(snapshots.afterJson.changedFields).toEqual(["prompt", "contentStatus"]);
    expect(new Set(snapshots.afterJson.changedFields).size).toBe(snapshots.afterJson.changedFields.length);
    expect(snapshots.afterJson.changedFields.length).toBeLessThanOrEqual(32);
    const serialized = JSON.stringify(snapshots);
    for (const sentinel of ["PROMPT_SENTINEL", "NEW_PROMPT_SENTINEL", "CANONICAL_SENTINEL", "EXPLANATION_SENTINEL", "OPTION_SENTINEL"]) expect(serialized).not.toContain(sentinel);
  });

  it("uses bounded allowlists for every active broad snapshot family", () => {
    const sensitive = { id: "id1", status: "DRAFT", parentId: "parent", sourceType: "MANUAL", prompt: "PROMPT_SENTINEL", answer: "CANONICAL_SENTINEL", description: "BODY_SENTINEL" };
    const outputs = [problemAuditSnapshots(sensitive, sensitive), topicAuditSnapshots(sensitive, sensitive), sourceAuditSnapshots(sensitive, sensitive), contentPackAuditSnapshots(sensitive, sensitive)];
    expect(JSON.stringify(outputs)).not.toContain("PROMPT_SENTINEL");
    expect(JSON.stringify(outputs)).not.toContain("CANONICAL_SENTINEL");
    expect(JSON.stringify(outputs)).not.toContain("BODY_SENTINEL");
  });
});
