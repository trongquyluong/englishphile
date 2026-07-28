import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_CLOUDFLARE_WRITING_MODEL,
  DEFAULT_WRITING_GLOBAL_DAILY_LIMIT,
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
  nextPracticeTasks: ["Viết một đoạn PEEL có dẫn chứng."],
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
    expect(isWritingGraderEnabled()).toBe(true);

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
      "https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/@cf/qwen/qwen3-30b-a3b-fp8",
    );
    expect(url).not.toContain("gateway");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret-token");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      response_format: {
        type: "json_schema",
      },
      max_tokens: 1400,
      temperature: 0.2,
    });
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
});
