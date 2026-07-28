import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_CLOUDFLARE_WRITING_MODEL,
  DEFAULT_WRITING_GLOBAL_DAILY_LIMIT,
  WRITING_RESULT_LIMITS,
  getCloudflareWritingModel,
  getWritingGlobalDailyLimit,
  gradeEssay,
  isWritingGraderEnabled,
} from "@/lib/ai/writing-grader";

const input = {
  prompt: "Should schools require a weekly reading journal?",
  essayType: "opinion" as const,
  targetWordCount: "250-300" as const,
  essayText:
    "Schools should require a weekly reading journal because it helps students reflect on what they read. ".repeat(
      12,
    ),
};

const providerResult = {
  criteria: {
    content: { score: 7.2, comment: "Bài viết trả lời đúng trọng tâm." },
    organization: { score: 6.7, comment: "Bố cục nhìn chung rõ." },
    language: { score: 6.2, comment: "Ngôn ngữ phù hợp." },
    mechanics: { score: 2.6, comment: "Cần kiểm tra dấu câu." },
  },
  overallComment: "Bài viết có hướng triển khai phù hợp.",
  strengths: ["Luận điểm rõ"],
  priorityIssues: ["Thêm dẫn chứng"],
  detailedFeedback: [
    {
      quote: "Schools should require",
      issue: "Khẳng định còn chung",
      explanation: "Cần nêu phạm vi rõ hơn.",
      suggestedRevision: "Secondary schools should require",
    },
  ],
  suggestedRewrite: {
    thesis: "A weekly reading journal should be required because it promotes reflection.",
  },
  nextPracticeTasks: [
    "Viết một đoạn PEEL có dẫn chứng.",
    "Luyện viết thesis rõ lập trường.",
    "Rà soát liên từ trong mỗi đoạn.",
  ],
  warnings: [],
};

function configureEnvironment() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
  vi.stubEnv("CLOUDFLARE_WRITING_MODEL", DEFAULT_CLOUDFLARE_WRITING_MODEL);
  vi.stubEnv("WRITING_AI_GLOBAL_DAILY_LIMIT", "100");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Cloudflare Writing grader configuration", () => {
  it("uses a conservative default global allowance", () => {
    expect(getWritingGlobalDailyLimit()).toBe(DEFAULT_WRITING_GLOBAL_DAILY_LIMIT);
  });

  it("fails closed for unsupported models or unsafe allowance values", () => {
    configureEnvironment();
    expect(DEFAULT_CLOUDFLARE_WRITING_MODEL).toBe(
      "@cf/meta/llama-3.1-8b-instruct-fast",
    );
    expect(getCloudflareWritingModel()).toBe(DEFAULT_CLOUDFLARE_WRITING_MODEL);
    expect(isWritingGraderEnabled()).toBe(true);

    vi.stubEnv("CLOUDFLARE_WRITING_MODEL", "@cf/qwen/qwen3-30b-a3b-fp8");
    expect(getCloudflareWritingModel()).toBeNull();
    expect(isWritingGraderEnabled()).toBe(false);

    vi.stubEnv("CLOUDFLARE_WRITING_MODEL", "@cf/unsupported/model");
    expect(getCloudflareWritingModel()).toBeNull();
    expect(isWritingGraderEnabled()).toBe(false);

    vi.stubEnv("CLOUDFLARE_WRITING_MODEL", DEFAULT_CLOUDFLARE_WRITING_MODEL);
    vi.stubEnv("WRITING_AI_GLOBAL_DAILY_LIMIT", "101");
    expect(getWritingGlobalDailyLimit()).toBeNull();
    expect(isWritingGraderEnabled()).toBe(false);
  });
});

describe("Cloudflare Writing grader request boundary", () => {
  it("calls the direct Workers AI endpoint with structured output and normalizes scores", async () => {
    configureEnvironment();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { response: providerResult },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await gradeEssay(input);

    expect(result.totalScore).toBe(22);
    expect(result.criteria.content.score).toBe(7);
    expect(result.criteria.mechanics.score).toBe(2.5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/@cf/meta/llama-3.1-8b-instruct-fast",
    );
    expect(url).not.toContain("gateway");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret-token");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      response_format: {
        type: "json_schema",
      },
      max_tokens: 2000,
      temperature: 0.2,
    });
    const schema = (
      body.response_format as {
        json_schema: {
          properties: Record<string, Record<string, unknown>>;
        };
      }
    ).json_schema;
    expect(schema.properties.strengths.maxItems).toBe(4);
    expect(schema.properties.priorityIssues.maxItems).toBe(4);
    expect(schema.properties.detailedFeedback.maxItems).toBe(3);
    expect(schema.properties.nextPracticeTasks).toMatchObject({
      minItems: 3,
      maxItems: 4,
    });
    expect(schema.properties.warnings.maxItems).toBe(3);
    expect(JSON.stringify(body)).toContain(input.essayText);
  });

  it("accepts the chat-completion response shape", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              choices: [{ message: { content: JSON.stringify(providerResult) } }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(gradeEssay(input)).resolves.toMatchObject({
      maxScore: 30,
      overallComment: providerResult.overallComment,
    });
  });

  it.each([
    { label: "direct object", result: providerResult },
    { label: "JSON string", result: JSON.stringify(providerResult) },
  ])("accepts the $label result envelope", async ({ result }) => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(gradeEssay(input)).resolves.toMatchObject({
      maxScore: 30,
      overallComment: providerResult.overallComment,
    });
  });

  it("safely truncates bounded fields and list counts before returning", async () => {
    configureEnvironment();
    const oversizedButSafe = {
      ...providerResult,
      criteria: {
        ...providerResult.criteria,
        content: {
          ...providerResult.criteria.content,
          comment: "c".repeat(WRITING_RESULT_LIMITS.criterionComment + 20),
        },
      },
      overallComment: "o".repeat(WRITING_RESULT_LIMITS.overallComment + 20),
      strengths: Array.from({ length: 6 }, (_, index) => `strength-${index}`),
      priorityIssues: Array.from({ length: 6 }, (_, index) => `issue-${index}`),
      detailedFeedback: Array.from({ length: 5 }, (_, index) => ({
        quote: `quote-${index}`,
        issue: `issue-${index}`,
        explanation: "e".repeat(WRITING_RESULT_LIMITS.explanation + 20),
        suggestedRevision: "r".repeat(
          WRITING_RESULT_LIMITS.suggestedRevision + 20,
        ),
      })),
      nextPracticeTasks: Array.from({ length: 6 }, (_, index) => `task-${index}`),
      warnings: Array.from({ length: 5 }, (_, index) => `warning-${index}`),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: { response: oversizedButSafe },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await gradeEssay(input);

    expect(result.criteria.content.comment).toHaveLength(
      WRITING_RESULT_LIMITS.criterionComment,
    );
    expect(result.overallComment).toHaveLength(
      WRITING_RESULT_LIMITS.overallComment,
    );
    expect(result.strengths).toHaveLength(WRITING_RESULT_LIMITS.strengths);
    expect(result.priorityIssues).toHaveLength(
      WRITING_RESULT_LIMITS.priorityIssues,
    );
    expect(result.detailedFeedback).toHaveLength(
      WRITING_RESULT_LIMITS.detailedFeedback,
    );
    expect(result.nextPracticeTasks).toHaveLength(
      WRITING_RESULT_LIMITS.nextPracticeTasksMax,
    );
    expect(result.warnings).toHaveLength(WRITING_RESULT_LIMITS.warnings);
    expect(Object.keys(result).sort()).toEqual([
      "criteria",
      "detailedFeedback",
      "maxScore",
      "nextPracticeTasks",
      "overallComment",
      "priorityIssues",
      "strengths",
      "suggestedRewrite",
      "totalScore",
      "warnings",
    ]);
  });

  it("maps provider throttling without parsing provider content", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );

    await expect(gradeEssay(input)).rejects.toMatchObject({
      code: "PROVIDER_RATE_LIMITED",
    });
  });

  it("maps only an allowlisted content-filter finish reason", async () => {
    configureEnvironment();
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              choices: [
                {
                  finish_reason: "content_filter",
                  message: { content: "" },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(gradeEssay(input)).rejects.toMatchObject({
      code: "CONTENT_BLOCKED",
    });
    expect(JSON.stringify(logger.mock.calls)).toContain("content_filter");
  });

  it("rejects malformed structured output", async () => {
    configureEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, result: { response: { unexpected: true } } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(gradeEssay(input)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it.each([
    { label: "empty", result: "" },
    { label: "malformed", result: "not-json" },
    { label: "truncated", result: '{"criteria":' },
    {
      label: "schema-invalid",
      result: JSON.stringify({ ...providerResult, criteria: undefined }),
    },
    {
      label: "unknown-key",
      result: JSON.stringify({ ...providerResult, rawProviderData: "forbidden" }),
    },
  ])("fails closed for $label structured output", async ({ result }) => {
    configureEnvironment();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, result: { response: result } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(gradeEssay(input)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("never logs the essay or provider token on network failure", async () => {
    configureEnvironment();
    const sentinel = "ESSAY-SENSITIVE-SENTINEL";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`network failure ${sentinel}`)),
    );

    await expect(
      gradeEssay({ ...input, essayText: `${input.essayText} ${sentinel}` }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain(sentinel);
    expect(logged).not.toContain("secret-token");
  });

  it("logs only allowlisted diagnostics across provider response failures", async () => {
    configureEnvironment();
    const sentinel = "PROVIDER-RESPONSE-SENSITIVE-SENTINEL";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const responses = [
      new Response(sentinel, { status: 503 }),
      new Response(`{${sentinel}`, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(
        JSON.stringify({
          success: true,
          result: { response: { ...providerResult, forbidden: sentinel } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ];
    const fetchMock = vi.fn();
    for (const response of responses) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < responses.length; index += 1) {
      await expect(gradeEssay(input)).rejects.toBeInstanceOf(Error);
    }

    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain(sentinel);
    expect(logged).not.toContain(input.essayText);
    expect(logged).not.toContain("secret-token");
    expect(logged).toMatch(
      /provider-http-failure|unreadable-envelope|result-schema-validation-failure/,
    );
  });
});
