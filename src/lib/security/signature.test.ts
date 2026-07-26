import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuthSecret, LOCAL_AUTH_SECRET_FALLBACK } from "@/lib/config";
import { createHash } from "node:crypto";
import { decodeCanonicalBase64Url, signaturesMatch } from "@/lib/security/signature";

describe("production signing boundary", () => {
  it.each([
    {},
    { SESSION_SECRET: "" },
    { SESSION_SECRET: "   " },
    { SESSION_SECRET: LOCAL_AUTH_SECRET_FALLBACK },
    { SESSION_SECRET: ` ${LOCAL_AUTH_SECRET_FALLBACK} ` },
  ])("rejects missing, empty, or fallback production secrets", (values) => {
    expect(() => getAuthSecret({ NODE_ENV: "production", ...values })).toThrow("Authentication signing configuration is unavailable.");
  });

  it("accepts configured production secrets and retains local fallback outside production", () => {
    expect(getAuthSecret({ NODE_ENV: "production", SESSION_SECRET: "synthetic-configured-secret" })).toBe("synthetic-configured-secret");
    expect(getAuthSecret({ NODE_ENV: "development" })).toBe(LOCAL_AUTH_SECRET_FALLBACK);
    expect(getAuthSecret({ NODE_ENV: "test", AUTH_SECRET: "synthetic-test-secret" })).toBe("synthetic-test-secret");
  });

  it("compares equal, unequal, and unequal-length signatures safely", () => {
    const first = createHash("sha256").update("first").digest("base64url");
    const second = createHash("sha256").update("second").digest("base64url");
    expect(signaturesMatch(first, first)).toBe(true);
    expect(signaturesMatch(first, second)).toBe(false);
    expect(signaturesMatch(first, first.slice(0, -1))).toBe(false);
  });

  it("rejects non-canonical, invalid-character, truncated, and oversized encodings", () => {
    const valid = createHash("sha256").update("value").digest("base64url");
    for (const malformed of [`${valid}=`, `${valid}!`, "A", valid.repeat(4)]) {
      expect(signaturesMatch(valid, malformed)).toBe(false);
    }
    expect(decodeCanonicalBase64Url(valid, 128)?.toString("base64url")).toBe(valid);
    expect(decodeCanonicalBase64Url("A", 128)).toBeNull();
  });
});
