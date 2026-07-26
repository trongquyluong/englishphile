import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  authorization: vi.fn(),
  origin: vi.fn(),
  rateLimit: vi.fn(),
  importContentPack: vi.fn(),
}));

vi.mock("@/lib/auth/content-admin-api", () => ({ requireContentAdminApi: boundaries.authorization }));
vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: boundaries.origin,
  getOriginErrorMessage: () => "Origin denied.",
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: boundaries.rateLimit,
  RATE_LIMITS: { CONTENT_PACK_COMMIT: (userId: string) => ({ action: "content-pack-commit", subject: userId }) },
}));
vi.mock("@/lib/content-packs/importer", () => ({ importContentPackFiles: boundaries.importContentPack }));

import { POST } from "@/app/api/admin/import/files/commit/route";

function request() {
  return new Request("http://integration.invalid/api/admin/import/files/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: [{ fileName: "synthetic.json", content: "SYNTHETIC" }] }),
  });
}

function result(
  contentPackStatus: "IMPORTED" | "PARTIALLY_IMPORTED" | "FAILED",
  statuses: Array<"IMPORTED" | "FAILED">,
) {
  return {
    summary: { validFiles: statuses.length },
    contentPack: { status: contentPackStatus },
    results: statuses.map((status, index) => ({ entryId: `entry-${index}`, status })),
  };
}

describe("upload-first commit route status (production handler with mocked collaborators)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundaries.authorization.mockResolvedValue({
      authorized: true,
      user: { id: "admin-a", email: "admin@integration.invalid", role: "ADMIN" },
    });
    boundaries.origin.mockResolvedValue({ valid: true });
    boundaries.rateLimit.mockResolvedValue({ status: "allowed" });
  });

  it("returns success only when at least one validated file actually committed", async () => {
    boundaries.importContentPack.mockResolvedValue(result("IMPORTED", ["IMPORTED"]));

    const response = await POST(request());

    expect(response.status).toBe(200);
  });

  it("returns 200 and preserves PARTIALLY_IMPORTED when one file commits and one fails", async () => {
    boundaries.importContentPack.mockResolvedValue(
      result("PARTIALLY_IMPORTED", ["IMPORTED", "FAILED"]),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.contentPack.status).toBe("PARTIALLY_IMPORTED");
    expect(payload.results.map((item: { status: string }) => item.status)).toEqual(["IMPORTED", "FAILED"]);
  });

  it("returns a generic failure status when every validated file failed to commit", async () => {
    boundaries.importContentPack.mockResolvedValue(result("FAILED", ["FAILED", "FAILED"]));

    const response = await POST(request());

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.contentPack.status).toBe("FAILED");
  });

  it("does not echo a raw database failure", async () => {
    boundaries.importContentPack.mockRejectedValue(new Error("RAW_DATABASE_SENTINEL"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("RAW_DATABASE_SENTINEL");
    expect(JSON.parse(text)).toEqual({ error: "Không thể hoàn tất gói dữ liệu." });
  });
});

describe("ImportCenter upload commit messages (static production-component wiring)", () => {
  it("contains distinct full-success, partial-success, and complete-failure branches", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/admin/ImportCenter.tsx"),
      "utf8",
    );

    expect(source).toContain('input.contentPackStatus === "IMPORTED"');
    expect(source).toContain('input.contentPackStatus === "PARTIALLY_IMPORTED"');
    expect(source).toContain("Import file hoàn tất.");
    expect(source).toContain("Đã import một phần.");
    expect(source).toContain("Không thể commit file hợp lệ.");
    expect(source).toContain("getContentPackCommitMessage({");
  });
});
