import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { requireContentAdminApi } from "@/lib/auth/content-admin-api";

describe("content-admin API guard runtime", () => {
  beforeEach(() => {
    vi.stubEnv("OWNER_EMAIL", " owner@example.test ");
    mocks.getCurrentUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["anonymous", null, 401],
    [
      "ordinary student",
      { id: "student-1", email: "student@example.test", role: "STUDENT" },
      403,
    ],
  ])("returns generic JSON for %s", async (_name, user, expectedStatus) => {
    mocks.getCurrentUser.mockResolvedValue(user);

    const result = await requireContentAdminApi();

    expect(result.authorized).toBe(false);
    if (result.authorized) throw new Error("expected authorization failure");
    expect(result.response.status).toBe(expectedStatus);
    expect(await result.response.json()).toEqual({ error: "Không có quyền truy cập." });
    expect(result).not.toHaveProperty("redirect");
  });

  it.each([
    ["stored ADMIN", { id: "admin-1", email: "admin@example.test", role: "ADMIN" }],
    [
      "OWNER_EMAIL STUDENT",
      { id: "owner-1", email: "OWNER@EXAMPLE.TEST", role: "STUDENT" },
    ],
  ])("accepts %s from the current-user loader", async (_name, user) => {
    mocks.getCurrentUser.mockResolvedValue(user);

    const result = await requireContentAdminApi();

    expect(result).toEqual({ authorized: true, user });
    expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
