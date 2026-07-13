import { describe, expect, it } from "vitest";
import {
  decideContentAdminApiAccess,
  evaluateContentAdminDeploymentPreflight,
  isConfiguredOwnerEmail,
  isContentAdminIdentity,
} from "@/lib/auth/content-admin-policy";
import { decideClassroomFeatureAccess } from "@/lib/features/retired-classroom-policy";
import { parsePortableUserRole } from "@/lib/import/portable-user-role";

describe("production content-admin policy runtime", () => {
  const ownerEmail = " owner@example.com ";

  it("accepts stored ADMIN and rejects an ordinary STUDENT", () => {
    expect(isContentAdminIdentity({ email: "admin@example.com", role: "ADMIN" }, ownerEmail)).toBe(true);
    expect(isContentAdminIdentity({ email: "student@example.com", role: "STUDENT" }, ownerEmail)).toBe(false);
  });

  it("accepts an OWNER_EMAIL STUDENT with trimmed case-insensitive matching", () => {
    expect(isConfiguredOwnerEmail("  OWNER@EXAMPLE.COM ", ownerEmail)).toBe(true);
    expect(isContentAdminIdentity({ email: "OWNER@example.com", role: "STUDENT" }, ownerEmail)).toBe(true);
  });

  it("rejects a nonmatching email and an unconfigured owner email", () => {
    expect(isContentAdminIdentity({ email: "other@example.com", role: "STUDENT" }, ownerEmail)).toBe(false);
    expect(isContentAdminIdentity({ email: "owner@example.com", role: "STUDENT" }, "  ")).toBe(false);
  });

  it("returns generic JSON-safe API decisions without redirect results", () => {
    const anonymous = decideContentAdminApiAccess(null, ownerEmail);
    const student = decideContentAdminApiAccess(
      { email: "student@example.com", role: "STUDENT" },
      ownerEmail,
    );
    const admin = decideContentAdminApiAccess(
      { email: "admin@example.com", role: "ADMIN" },
      ownerEmail,
    );
    const owner = decideContentAdminApiAccess(
      { email: "OWNER@example.com", role: "STUDENT" },
      ownerEmail,
    );

    expect(anonymous).toEqual({ allowed: false, status: 401, body: { error: "Không có quyền truy cập." } });
    expect(student).toEqual({ allowed: false, status: 403, body: { error: "Không có quyền truy cập." } });
    expect(admin).toEqual({ allowed: true });
    expect(owner).toEqual({ allowed: true });
    expect(JSON.stringify(anonymous)).not.toContain("redirect");
  });

  it("keeps OWNER_EMAIL access after a legacy role is downgraded to STUDENT", () => {
    const downgradedRole = parsePortableUserRole("TEACHER").role;
    expect(
      isContentAdminIdentity(
        { email: "OWNER@example.com", role: downgradedRole },
        ownerEmail,
      ),
    ).toBe(true);
  });

  it("requires a stored ADMIN or a resolvable OWNER_EMAIL user before deployment", () => {
    expect(
      evaluateContentAdminDeploymentPreflight({
        storedAdminCount: 1,
        ownerEmailResolvesToCurrentUser: false,
        legacyTeacherCount: 3,
      }),
    ).toEqual({ ready: true, countsAreValid: true, legacyTeacherCount: 3 });

    expect(
      evaluateContentAdminDeploymentPreflight({
        storedAdminCount: 0,
        ownerEmailResolvesToCurrentUser: true,
        legacyTeacherCount: 3,
      }).ready,
    ).toBe(true);

    expect(
      evaluateContentAdminDeploymentPreflight({
        storedAdminCount: 0,
        ownerEmailResolvesToCurrentUser: false,
        legacyTeacherCount: 3,
      }).ready,
    ).toBe(false);
  });

  it("fails the deployment preflight closed on invalid aggregate counts", () => {
    expect(
      evaluateContentAdminDeploymentPreflight({
        storedAdminCount: -1,
        ownerEmailResolvesToCurrentUser: true,
        legacyTeacherCount: 0,
      }).ready,
    ).toBe(false);
  });
});

describe("portable user role runtime mapping", () => {
  it("preserves STUDENT and ADMIN", () => {
    expect(parsePortableUserRole("STUDENT")).toEqual({ role: "STUDENT", legacyTeacherDowngraded: false });
    expect(parsePortableUserRole("ADMIN")).toEqual({ role: "ADMIN", legacyTeacherDowngraded: false });
  });

  it("downgrades the legacy role to STUDENT and never maps it to ADMIN", () => {
    expect(parsePortableUserRole("TEACHER")).toEqual({ role: "STUDENT", legacyTeacherDowngraded: true });
  });

  it("rejects unknown roles instead of mapping them to ADMIN", () => {
    expect(() => parsePortableUserRole("SUPER_ADMIN")).toThrow("Vai trò người dùng trong bản sao lưu không hợp lệ.");
  });
});

describe("retired classroom feature runtime policy", () => {
  it.each([null, { role: "STUDENT" }, { role: "ADMIN" }, { ownerEmailMatch: true }])(
    "returns the same non-enumerating decision for %j",
    (principal) => {
      expect(decideClassroomFeatureAccess(principal)).toEqual({
        allowed: false,
        status: 404,
        body: { error: "Không tìm thấy tài nguyên." },
      });
    },
  );
});
