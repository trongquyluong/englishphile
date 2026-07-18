import { describe, expect, it, vi } from "vitest";
import {
  PORTABLE_CONTEST_SELECT,
  PORTABLE_MANIFEST_MAX_BYTES,
  PORTABLE_USER_SELECT,
  authorizePortableImportExecution,
  createAuthorizedPortableImportRuntime,
  parsePortableImportArguments,
  parsePortableManifestBytes,
  normalizePortableManifest,
  portableManifestCountLines,
  sanitizePortableDiagnosticAttempt,
  serializePortableExportArtifact,
} from "@/lib/operations/portable-data";
import { classifySafeError, safeErrorSignal } from "@/lib/operations/safe-error";

describe("portable operator production helpers", () => {
  const validManifest = {
    version: "1.0",
    exportedAt: "2026-07-18T00:00:00.000Z",
    counts: { users: 1, contests: 2 },
  };

  it("has explicit export plans without credential fields", () => {
    expect(PORTABLE_USER_SELECT).not.toHaveProperty("passwordHash");
    expect(PORTABLE_CONTEST_SELECT).not.toHaveProperty("accessCode");
  });

  it("removes credentials recursively at the final serialized artifact boundary", () => {
    const users = serializePortableExportArtifact("users.safe.json", [{
      id: "u1", email: "synthetic@example.test", role: "STUDENT",
      passwordHash: "PASSWORD_HASH_SENTINEL",
      profile: { id: "profile-1", bio: "safe", passwordHash: "NESTED_HASH_SENTINEL" },
      unknown: { passwordHash: "DEEP_HASH_SENTINEL" },
    }]);
    const contests = serializePortableExportArtifact("contests.json", [{
      id: "c1", slug: "contest", accessCode: "ACCESS_CODE_SENTINEL",
      nested: { accessCode: "NESTED_CODE_SENTINEL" },
    }]);
    for (const sentinel of ["PASSWORD_HASH_SENTINEL", "NESTED_HASH_SENTINEL", "DEEP_HASH_SENTINEL"]) expect(users).not.toContain(sentinel);
    for (const sentinel of ["ACCESS_CODE_SENTINEL", "NESTED_CODE_SENTINEL"]) expect(contests).not.toContain(sentinel);
    expect(JSON.parse(contests)[0]).not.toHaveProperty("accessCode");
  });

  it("sanitizes historical diagnostic JSON without mutating it", () => {
    const attempt = {
      id: "a1", userId: "u1", status: "COMPLETED", startedAt: "start", completedAt: "end", score: 1, total: 1, estimatedLevel: "B2", createdAt: "created", updatedAt: "updated",
      skillBreakdownJson: [{ skillType: "READING", label: "Reading", correct: 1, attempted: 1, weightedCorrect: 1, weightedTotal: 1, accuracy: 1, statusLabel: "ok", feedback: "NESTED_FEEDBACK_SENTINEL" }],
      topicBreakdownJson: [],
      recommendationJson: { questionIds: ["q1"], results: [{ questionId: "q1", problemId: "p1", skillType: "READING", difficulty: "B2", isCorrect: true, correctAnswer: "CANONICAL_SENTINEL", nested: { modelAnswer: "MODEL_SENTINEL" } }], unknown: "UNKNOWN_SENTINEL" },
    };
    const before = JSON.stringify(attempt);
    const sanitized = sanitizePortableDiagnosticAttempt(attempt);
    expect(JSON.stringify(attempt)).toBe(before);
    const output = JSON.stringify(sanitized);
    for (const sentinel of ["NESTED_FEEDBACK_SENTINEL", "CANONICAL_SENTINEL", "MODEL_SENTINEL", "UNKNOWN_SENTINEL"]) expect(output).not.toContain(sentinel);
    expect(sanitized.recommendationJson.results[0]).toEqual({ questionId: "q1", problemId: "p1", skillType: "READING", difficulty: "B2", isCorrect: true });
    const artifact = serializePortableExportArtifact("diagnostic-attempts.json", [attempt]);
    for (const sentinel of ["NESTED_FEEDBACK_SENTINEL", "CANONICAL_SENTINEL", "MODEL_SENTINEL", "UNKNOWN_SENTINEL"]) expect(artifact).not.toContain(sentinel);
  });

  it("turns malformed diagnostic legacy values into the documented minimal safe shape", () => {
    const artifact = JSON.parse(serializePortableExportArtifact("diagnostic-attempts.json", [{
      id: "attempt-1",
      skillBreakdownJson: "malformed",
      topicBreakdownJson: { unexpected: true },
      recommendationJson: ["unexpected"],
    }]));
    expect(artifact[0]).toEqual(expect.objectContaining({
      id: "attempt-1",
      skillBreakdownJson: [],
      topicBreakdownJson: [],
      recommendationJson: { questionIds: [], sections: [], coverageWarnings: [], results: [], scoring: null },
    }));
  });

  it("parses only bounded, supported portable manifest metadata", () => {
    const parsed = parsePortableManifestBytes(new TextEncoder().encode(JSON.stringify({
      ...validManifest,
      note: "ignored legacy note",
      warnings: ["ignored legacy warning"],
    })));
    expect(parsed).toEqual({ ok: true, value: validManifest });
    expect(parsePortableManifestBytes(new TextEncoder().encode(JSON.stringify({ ...validManifest, version: "2.0" })))).toEqual({ ok: false });
    expect(parsePortableManifestBytes(new TextEncoder().encode(JSON.stringify({ ...validManifest, counts: { unknownRows: 1 } })))).toEqual({ ok: false });
    for (const count of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(normalizePortableManifest({ ...validManifest, counts: { users: count } })).toEqual({ ok: false });
    }
  });

  it("rejects an oversized manifest before JSON parsing", () => {
    const parseSpy = vi.spyOn(JSON, "parse");
    try {
      expect(parsePortableManifestBytes(new Uint8Array(PORTABLE_MANIFEST_MAX_BYTES + 1))).toEqual({ ok: false });
      expect(parseSpy).not.toHaveBeenCalled();
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("rejects prototype keys and accessors without invoking them", () => {
    expect(parsePortableManifestBytes(new TextEncoder().encode(
      '{"version":"1.0","exportedAt":"2026-07-18T00:00:00.000Z","counts":{"__proto__":1}}',
    ))).toEqual({ ok: false });
    let getterCalled = false;
    const hostile = Object.defineProperty({ ...validManifest }, "note", {
      enumerable: true,
      get() { getterCalled = true; return "not-read"; },
    });
    expect(normalizePortableManifest(hostile)).toEqual({ ok: false });
    expect(getterCalled).toBe(false);
  });

  it("formats only validated known count names and never raw manifest metadata", () => {
    const sentinels = [
      "\u001b[31mTERMINAL_SENTINEL",
      "NEWLINE_SENTINEL\nSECOND_LINE",
      "IDENTITY_SENTINEL",
      "PATH_SENTINEL",
      "CONNECTION_SENTINEL",
    ];
    const parsed = parsePortableManifestBytes(new TextEncoder().encode(JSON.stringify({
      ...validManifest,
      note: sentinels.join("|"),
    })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("synthetic manifest should parse");
    const sink = vi.fn();
    for (const line of portableManifestCountLines(parsed.value)) sink(line);
    const captured = JSON.stringify(sink.mock.calls);
    expect(captured).toContain("users");
    expect(captured).toContain("contests");
    for (const sentinel of sentinels) expect(captured).not.toContain(sentinel);
  });

  it("fails malformed flags closed and preserves dry-run/yes semantics", () => {
    expect(parsePortableImportArguments(["--input", "bundle", "--dry-run"])).toEqual({
      ok: true,
      value: { inputDir: "bundle", targetUrl: "", dryRun: true, yes: false },
    });
    expect(parsePortableImportArguments(["--input", "bundle", "--yes"])).toEqual({
      ok: true,
      value: { inputDir: "bundle", targetUrl: "", dryRun: false, yes: true },
    });
    for (const args of [[], ["--unknown"], ["--input"], ["--input", "--yes"], ["--input", "a", "--input", "b"]]) {
      expect(parsePortableImportArguments(args)).toEqual({ ok: false });
    }
  });

  it("authorizes dry-run, explicit non-TTY, and interactive confirmation without a client", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    expect(await authorizePortableImportExecution({ dryRun: true, yes: false, isTTY: false }, confirm)).toBe("dry-run");
    expect(await authorizePortableImportExecution({ dryRun: false, yes: true, isTTY: false }, confirm)).toBe("live");
    expect(await authorizePortableImportExecution({ dryRun: false, yes: false, isTTY: false }, confirm)).toBe("rejected");
    expect(await authorizePortableImportExecution({ dryRun: false, yes: false, isTTY: true }, confirm)).toBe("live");
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockResolvedValueOnce(false);
    expect(await authorizePortableImportExecution({ dryRun: false, yes: false, isTTY: true }, confirm)).toBe("aborted");
  });

  it("creates a client only after intentional live authorization", async () => {
    const createClient = vi.fn(() => ({ synthetic: true }));
    const confirmInteractive = vi.fn().mockResolvedValue(true);
    for (const input of [
      { dryRun: true, yes: false, isTTY: false },
      { dryRun: false, yes: false, isTTY: false },
    ]) {
      const runtime = await createAuthorizedPortableImportRuntime(input, { createClient, confirmInteractive });
      expect(runtime.mode).not.toBe("live");
    }
    expect(createClient).not.toHaveBeenCalled();
    const live = await createAuthorizedPortableImportRuntime(
      { dryRun: false, yes: true, isTTY: false },
      { createClient, confirmInteractive },
    );
    expect(live).toEqual({ mode: "live", client: { synthetic: true } });
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("classifies errors without returning raw error text", () => {
    expect(classifySafeError(Object.assign(new Error("CONNECTION_TARGET_SENTINEL"), { code: "P1001" }))).toBe("database");
    expect(classifySafeError(new Error("RAW_IMPORT_SENTINEL"))).toBe("unknown");
    let getterCalled = false;
    const hostile = Object.create(null, {
      code: { get() { getterCalled = true; return "P1001"; } },
      message: { value: "RAW_MESSAGE_SENTINEL", enumerable: true },
      stack: { value: "RAW_STACK_SENTINEL", enumerable: true },
      cause: { value: "RAW_CAUSE_SENTINEL", enumerable: true },
    });
    const sink = vi.fn();
    sink("Operation failed.", safeErrorSignal("portable-import", hostile));
    expect(getterCalled).toBe(false);
    const captured = JSON.stringify(sink.mock.calls);
    expect(captured).toContain("portable-import");
    expect(captured).toContain("unknown");
    for (const sentinel of ["RAW_MESSAGE_SENTINEL", "RAW_STACK_SENTINEL", "RAW_CAUSE_SENTINEL"]) expect(captured).not.toContain(sentinel);
  });
});
