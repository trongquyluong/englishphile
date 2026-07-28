import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  getAuthSecret: () => "synthetic-reviewed-session-secret",
}));

import { deriveWritingDraftKey } from "@/lib/security/writing-draft-key";

describe("Writing draft opaque key", () => {
  it("is stable per authenticated user and prompt without exposing either input", () => {
    const first = deriveWritingDraftKey("learner-sensitive-id", "machines-at-home");
    const repeated = deriveWritingDraftKey(
      "learner-sensitive-id",
      "machines-at-home",
    );
    const otherUser = deriveWritingDraftKey(
      "other-learner-sensitive-id",
      "machines-at-home",
    );
    const otherPrompt = deriveWritingDraftKey(
      "learner-sensitive-id",
      "technology-and-social-interaction",
    );

    expect(first).toBe(repeated);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain("learner-sensitive-id");
    expect(first).not.toContain("machines-at-home");
    expect(otherUser).not.toBe(first);
    expect(otherPrompt).not.toBe(first);
  });
});
