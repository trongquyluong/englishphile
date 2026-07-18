import { describe, expect, it } from "vitest";
import {
  PRACTICE_INPUT_LIMITS,
  PracticeSubmissionInputError,
  normalizeBoundedPracticeJson,
  parseRandomPracticeSubmissionBody,
  parseSingleProblemSubmissionBody,
  readBoundedPracticeRequestBody,
  requireAnswerKeysBelongToQuestions,
  requireSupportedQuestionAnswerShapes,
} from "@/lib/security/submission-input";

function requestWithBytes(bytes: Uint8Array, headers?: HeadersInit) {
  return new Request("http://localhost/api/submissions", { method: "POST", headers, body: bytes as BodyInit });
}

function streamedRequest(chunks: Uint8Array[], headers?: HeadersInit, onCancel?: () => void) {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) return controller.close();
      controller.enqueue(chunks[index++]);
    },
    cancel() { onCancel?.(); },
  });
  return new Request("http://localhost/api/submissions", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded practice input production helper", () => {
  it("accepts an actual Request body exactly at the UTF-8 byte boundary", async () => {
    const json = JSON.stringify({ problemId: "p1", answers: { q1: "ok" } });
    const body = json + " ".repeat(PRACTICE_INPUT_LIMITS.maxBodyBytes - Buffer.byteLength(json));
    const raw = await readBoundedPracticeRequestBody(requestWithBytes(new TextEncoder().encode(body)));
    expect(Buffer.byteLength(raw)).toBe(PRACTICE_INPUT_LIMITS.maxBodyBytes);
    expect(parseSingleProblemSubmissionBody(raw).answers.q1).toBe("ok");
  });

  it("rejects one byte over and cancels an honest excessive Content-Length without reader consumption", async () => {
    const oversized = new Uint8Array(PRACTICE_INPUT_LIMITS.maxBodyBytes + 1);
    await expect(readBoundedPracticeRequestBody(requestWithBytes(oversized))).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    let cancelled = false;
    const request = streamedRequest([new TextEncoder().encode("{}")], { "content-length": String(PRACTICE_INPUT_LIMITS.maxBodyBytes + 1) }, () => { cancelled = true; });
    await expect(readBoundedPracticeRequestBody(request)).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    expect(cancelled).toBe(true);
  });

  it("cancels a chunked stream as soon as the byte boundary is crossed", async () => {
    let cancelled = false;
    const request = streamedRequest([
      new Uint8Array(PRACTICE_INPUT_LIMITS.maxBodyBytes),
      new Uint8Array([1]),
      new Uint8Array(100),
    ], undefined, () => { cancelled = true; });
    await expect(readBoundedPracticeRequestBody(request)).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    expect(cancelled).toBe(true);
  });

  it("does not trust a false small or malformed Content-Length", async () => {
    const oversized = new Uint8Array(PRACTICE_INPUT_LIMITS.maxBodyBytes + 1);
    await expect(readBoundedPracticeRequestBody(requestWithBytes(oversized, { "content-length": "1" }))).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    await expect(readBoundedPracticeRequestBody(requestWithBytes(oversized, { "content-length": "not-a-number" }))).rejects.toBeInstanceOf(PracticeSubmissionInputError);
  });

  it("counts multibyte UTF-8 bytes and rejects malformed UTF-8 or JSON generically", async () => {
    const multibyte = JSON.stringify({ problemId: "p", answers: { q: "ế".repeat(30_000) } });
    expect(multibyte.length).toBeLessThan(PRACTICE_INPUT_LIMITS.maxBodyBytes);
    await expect(readBoundedPracticeRequestBody(requestWithBytes(new TextEncoder().encode(multibyte)))).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    await expect(readBoundedPracticeRequestBody(requestWithBytes(new Uint8Array([0x7b, 0xff, 0x7d])))).rejects.toBeInstanceOf(PracticeSubmissionInputError);
    const malformedJson = await readBoundedPracticeRequestBody(requestWithBytes(new TextEncoder().encode("{malformed")));
    expect(() => parseSingleProblemSubmissionBody(malformedJson))
      .toThrow(PracticeSubmissionInputError);
  });

  it("creates prototype-safe maps for a known answer", () => {
    const parsed = parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p1", answers: { q1: { part: "A", correction: "x" } } }));
    expect(Object.getPrototypeOf(parsed.answers)).toBeNull();
    expect(Object.getPrototypeOf(parsed.answers.q1)).toBeNull();
    expect(parsed.answers.q1).toEqual({ part: "A", correction: "x" });
  });

  it.each(["__proto__", "prototype", "constructor"])("rejects forbidden nested property %s", (key) => {
    const raw = `{"problemId":"p1","answers":{"q1":{"${key}":"sentinel"}}}`;
    expect(() => parseSingleProblemSubmissionBody(raw)).toThrow(PracticeSubmissionInputError);
  });

  it("rejects duplicate random question identifiers", () => {
    expect(() => parseRandomPracticeSubmissionBody(JSON.stringify({ questionIds: ["q1", "q1"], answers: {} }))).toThrow(PracticeSubmissionInputError);
  });

  it("rejects excessive count, depth, array, value, and total body size", () => {
    const answers = Object.fromEntries(Array.from({ length: PRACTICE_INPUT_LIMITS.maxAnswerEntries + 1 }, (_, i) => [`q${i}`, "x"]));
    expect(() => parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p", answers }))).toThrow();
    expect(() => parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p", answers: { q: { a: { b: { c: { d: "x" } } } } } }))).toThrow();
    expect(() => parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p", answers: { q: Array(PRACTICE_INPUT_LIMITS.maxArrayLength + 1).fill("x") } }))).toThrow();
    expect(() => parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p", answers: { q: "x".repeat(PRACTICE_INPUT_LIMITS.maxAnswerBytes + 1) } }))).toThrow();
    const aggregate = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`q${i}`, "x".repeat(4000)]));
    expect(() => parseSingleProblemSubmissionBody(JSON.stringify({ problemId: "p", answers: aggregate }))).toThrow();
    expect(() => parseSingleProblemSubmissionBody("x".repeat(PRACTICE_INPUT_LIMITS.maxBodyBytes + 1))).toThrow();
  });

  it("rejects sparse arrays, non-finite numbers, undefined, bigint, and executable JSON values", () => {
    const sparse: unknown[] = [];
    sparse[1] = "value";
    for (const value of [sparse, Number.NaN, Number.POSITIVE_INFINITY, undefined, BigInt(1), () => "value"]) {
      expect(() => normalizeBoundedPracticeJson(value)).toThrow(PracticeSubmissionInputError);
    }
    let getterCalled = false;
    const accessor = Object.defineProperty({}, "answer", { enumerable: true, get() { getterCalled = true; return "value"; } });
    expect(() => normalizeBoundedPracticeJson(accessor)).toThrow(PracticeSubmissionInputError);
    expect(getterCalled).toBe(false);
  });

  it("rejects answer keys outside the fetched question set", () => {
    expect(() => requireAnswerKeysBelongToQuestions({ q1: "ok", foreign: "no" }, ["q1"])).toThrow(PracticeSubmissionInputError);
  });

  it("accepts every production-rendered answer shape and rejects unrelated shapes", () => {
    const stringTypes = [
      "PRONUNCIATION_ODD_ONE_OUT", "MCQ", "OPEN_CLOZE", "GUIDED_CLOZE",
      "WORD_FORMATION", "SENTENCE_TRANSFORMATION", "READING_MCQ", "LISTENING_MCQ",
      "LISTENING_SHORT_ANSWER", "TRIOS_GAPPED_SENTENCES", "SHORT_ANSWER",
    ] as const;
    for (const type of stringTypes) {
      expect(() => requireSupportedQuestionAnswerShapes({ q: "learner answer" }, [{ id: "q", type }])).not.toThrow();
    }
    expect(() => requireSupportedQuestionAnswerShapes(
      { q: { part: "A", correction: "replacement" } },
      [{ id: "q", type: "ERROR_IDENTIFICATION" }],
    )).not.toThrow();
    expect(() => requireSupportedQuestionAnswerShapes(
      { q: { thesis: "t", mainIdea1: "a", mainIdea2: "b", vocabulary: "v", essay: "essay" } },
      [{ id: "q", type: "WRITING_PROMPT" }],
    )).not.toThrow();
    expect(() => requireSupportedQuestionAnswerShapes({ q: ["unexpected"] }, [{ id: "q", type: "MCQ" }])).toThrow();
    expect(() => requireSupportedQuestionAnswerShapes({ q: { essay: "ok", extra: "no" } }, [{ id: "q", type: "WRITING_PROMPT" }])).toThrow();
  });
});
