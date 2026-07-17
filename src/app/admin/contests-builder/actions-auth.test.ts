import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateSection: vi.fn(),
  createSectionWithQuestions: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/admin/contest-mutations", () => ({
  archiveContestAtomically: vi.fn(),
  createContestQuestion: vi.fn(),
  createContestSection: vi.fn(),
  createContestSectionWithQuestions: mocks.createSectionWithQuestions,
  deleteContestQuestion: vi.fn(),
  deleteContestSection: vi.fn(),
  getContestPublishErrors: vi.fn(),
  publishContestAtomically: vi.fn(),
  updateContestQuestion: vi.fn(),
  updateContestSection: mocks.updateSection,
}));
vi.mock("@/lib/admin/mutation-locks", () => ({
  ADMIN_RESOURCE_UNAVAILABLE: "Tài nguyên không tồn tại hoặc không còn khả dụng.",
  lockContestForAdminMutation: vi.fn(),
}));

import {
  createSectionWithQuestionsAction,
  updateSectionAction,
} from "@/app/admin/contests-builder/actions";
import { MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS } from "@/lib/admin/contest-section-placeholders";

function sectionForm() {
  const form = new FormData();
  form.set("contestId", "contest-a");
  form.set("sectionId", "section-a");
  form.set("title", "Section");
  form.set("skillType", "READING");
  return form;
}

function placeholderForm(questionCount: string) {
  const form = new FormData();
  form.set("contestId", "contest-a");
  form.set("title", "Reading");
  form.set("skillType", "READING");
  form.set("questionType", "READING_MCQ");
  form.set("questionCount", questionCount);
  return form;
}

describe("contest Server Action authorization ordering (production action with mocked guard/helper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    mocks.updateSection.mockResolvedValue({ ok: true, contestId: "contest-a" });
    mocks.createSectionWithQuestions.mockResolvedValue({ ok: true, contestId: "contest-a" });
  });

  it.each(["anonymous", "ordinary STUDENT", "missing/deleted session user"])(
    "denies %s before scoped resource lookup",
    async () => {
      mocks.requireAdmin.mockRejectedValue(new Error("NOT_AUTHORIZED"));
      await expect(updateSectionAction(sectionForm())).rejects.toThrow("NOT_AUTHORIZED");
      expect(mocks.updateSection).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["stored ADMIN", { id: "admin-a", role: "ADMIN", email: "admin@example.test" }],
    ["OWNER_EMAIL-equivalent current user", { id: "owner-a", role: "STUDENT", email: "owner@example.test" }],
  ])("allows %s through the same global-peer mutation path", async (_label, user) => {
    mocks.requireAdmin.mockResolvedValue(user);
    await expect(updateSectionAction(sectionForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.updateSection).toHaveBeenCalledWith(
      "contest-a",
      "section-a",
      expect.objectContaining({ title: "Section", skillType: "READING" }),
      user.id,
    );
  });

  it.each([
    ["zero", "0", 0],
    ["maximum", String(MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS), MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS],
  ])("accepts the %s placeholder boundary", async (_label, value, expectedCount) => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-a", role: "ADMIN", email: "admin@example.test" });
    await expect(createSectionWithQuestionsAction(placeholderForm(value))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.createSectionWithQuestions).toHaveBeenCalledWith(
      "contest-a",
      expect.objectContaining({ title: "Reading", skillType: "READING" }),
      expect.arrayContaining([]),
      "admin-a",
    );
    expect(mocks.createSectionWithQuestions.mock.calls[0][2]).toHaveLength(expectedCount);
  });

  it.each([
    ["maximum plus one", String(MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS + 1)],
    ["negative", "-1"],
    ["fractional", "1.5"],
    ["NaN", "NaN"],
    ["extremely large", "999999999999999999999999999999999999"],
  ])("rejects %s placeholder input before invoking the transactional helper", async (_label, value) => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-a", role: "ADMIN", email: "admin@example.test" });
    await expect(createSectionWithQuestionsAction(placeholderForm(value))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.createSectionWithQuestions).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("error="));
  });
});
