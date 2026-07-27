import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RAW_FORMULA_SENTINEL,
  UNRELATED_WORKBOOK_SENTINEL,
  createSyntheticContestWorkbook,
} from "@/lib/import/test-fixtures/synthetic-contest-workbook";

const boundaries = vi.hoisted(() => ({
  authorization: vi.fn(),
  origin: vi.fn(),
  rateLimit: vi.fn(),
  persistContest: vi.fn(),
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
vi.mock("@/app/admin/contests-builder/actions", () => ({
  importContestFromParsedAction: boundaries.persistContest,
}));

import { POST } from "@/app/api/admin/contests-import/parse/route";

async function requestWithWorkbook(variant: "valid" | "formula"): Promise<NextRequest> {
  const body = new FormData();
  body.set("file", new File(
    [await createSyntheticContestWorkbook(variant)],
    `${variant}.xlsx`,
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ));
  return new Request("http://integration.invalid/api/admin/contests-import/parse", {
    method: "POST",
    body,
  }) as NextRequest;
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe("contest spreadsheet parse route formula contract (actual handler/parser runtime)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundaries.authorization.mockResolvedValue({
      authorized: true,
      user: { id: "admin-1", email: "admin@integration.invalid", role: "ADMIN" },
    });
    boundaries.origin.mockResolvedValue({ valid: true });
    boundaries.rateLimit.mockResolvedValue({ status: "allowed" });
  });

  it("returns the safe preview response for an authorized valid workbook", async () => {
    const response = await POST(await requestWithWorkbook("valid"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toMatchObject({
      data: {
        info: { title: "Synthetic contest" },
        sections: [{ sectionId: "section-1" }],
        questions: [{ questionId: "question-1" }],
      },
      errors: [],
      warnings: [],
    });
    expect(boundaries.persistContest).not.toHaveBeenCalled();
  });

  it("returns bounded formula validation without persistence or sensitive content", async () => {
    const response = await POST(await requestWithWorkbook("formula"));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toEqual({
      data: null,
      errors: [{
        sheet: "Contest_Info",
        row: 2,
        field: "B2",
        code: "FORMULA_NOT_ALLOWED",
        message: "Ô B2 trong sheet \"Contest_Info\" chứa công thức Excel. Không chấp nhận công thức. Hãy chuyển thành giá trị tĩnh rồi upload lại.",
      }],
      warnings: [],
    });
    expect(boundaries.persistContest).not.toHaveBeenCalled();

    expect(collectKeys(payload)).not.toEqual(expect.arrayContaining([
      "stack",
      "cause",
      "query",
      "path",
      "connectionString",
      "providerError",
      "rawError",
    ]));
    for (const forbidden of [
      RAW_FORMULA_SENTINEL,
      UNRELATED_WORKBOOK_SENTINEL,
      "postgresql://",
      "PrismaClient",
      "node_modules",
      "C:\\",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
