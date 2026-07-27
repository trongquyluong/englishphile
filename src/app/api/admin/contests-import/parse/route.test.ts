import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_SIZE_BYTES } from "@/lib/import/resource-limits";

const boundaries = vi.hoisted(() => ({
  authorization: vi.fn(),
  origin: vi.fn(),
  rateLimit: vi.fn(),
  parseExcelContest: vi.fn(),
}));

vi.mock("@/lib/auth/content-admin-api", () => ({
  requireContentAdminApi: boundaries.authorization,
}));
vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: boundaries.origin,
  getOriginErrorMessage: () => "Origin denied.",
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: boundaries.rateLimit,
  RATE_LIMITS: {
    EXCEL_PARSE: (userId: string) => ({ action: "excel-parse", subject: userId }),
  },
}));
vi.mock("@/lib/import/excel-contest-parser", () => ({
  parseExcelContest: boundaries.parseExcelContest,
}));

import { POST } from "@/app/api/admin/contests-import/parse/route";

function requestWithFile(file: File): NextRequest {
  const body = new FormData();
  body.set("file", file);
  return new Request("http://integration.invalid/api/admin/contests-import/parse", {
    method: "POST",
    body,
  }) as NextRequest;
}

describe("contest spreadsheet parse route (runtime production-boundary with mocked collaborators)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundaries.authorization.mockResolvedValue({
      authorized: true,
      user: { id: "admin-1", email: "admin@integration.invalid", role: "ADMIN" },
    });
    boundaries.origin.mockResolvedValue({ valid: true });
    boundaries.rateLimit.mockResolvedValue({ status: "allowed" });
    boundaries.parseExcelContest.mockResolvedValue({ data: null, errors: [], warnings: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the authorization response before reading or parsing a file", async () => {
    boundaries.authorization.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Không có quyền truy cập." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await POST(new Request(
      "http://integration.invalid/api/admin/contests-import/parse",
      { method: "POST" },
    ) as NextRequest);

    expect(response.status).toBe(403);
    expect(boundaries.origin).not.toHaveBeenCalled();
    expect(boundaries.rateLimit).not.toHaveBeenCalled();
    expect(boundaries.parseExcelContest).not.toHaveBeenCalled();
  });

  it("rejects an oversized workbook before ExcelJS parsing", async () => {
    const file = new File(
      [new Uint8Array(MAX_FILE_SIZE_BYTES + 1)],
      "oversized.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    );

    const response = await POST(requestWithFile(file));

    expect(response.status).toBe(413);
    expect(boundaries.parseExcelContest).not.toHaveBeenCalled();
  });

  it("rejects a malformed workbook signature before ExcelJS parsing", async () => {
    const response = await POST(requestWithFile(new File(["not an xlsx"], "malformed.xlsx")));

    expect(response.status).toBe(400);
    expect(boundaries.parseExcelContest).not.toHaveBeenCalled();
  });

  it("does not return or log a raw dependency failure", async () => {
    const rawSentinel = "RAW_DEPENDENCY_ERROR_SENTINEL";
    boundaries.parseExcelContest.mockRejectedValue(new Error(rawSentinel));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const file = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
      "synthetic.xlsx",
    );

    const response = await POST(requestWithFile(file));
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).not.toContain(rawSentinel);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(rawSentinel);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
