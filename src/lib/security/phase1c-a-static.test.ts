import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Phase 1C-A static role migration checks", () => {
  const migrationPath = "prisma/migrations/20260713160000_phase1c_a_role_policy/migration.sql";

  it("downgrades legacy users before recreating the enum without destructive table operations", () => {
    const migration = source(migrationPath);
    expect(migration.indexOf("BEGIN;")).toBeLessThan(migration.indexOf("UPDATE \"User\""));
    expect(migration.indexOf('WHERE "role" = \'TEACHER\'')).toBeLessThan(migration.indexOf('ALTER TYPE "Role"'));
    expect(migration.indexOf('ALTER COLUMN "role" DROP DEFAULT')).toBeLessThan(
      migration.indexOf('ALTER TYPE "Role" RENAME'),
    );
    expect(migration).toContain("CREATE TYPE \"Role\" AS ENUM ('STUDENT', 'ADMIN')");
    expect(migration).toContain('SET DEFAULT \'STUDENT\'::"Role"');
    expect(migration.indexOf('DROP TYPE "Role_legacy"')).toBeLessThan(
      migration.indexOf("COMMIT;"),
    );
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/CASCADE/i);
    expect(migration).not.toMatch(/(?:DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE)\s+"(?:Classroom|Assignment)/i);
  });

  it("does not recreate retired classroom or assignment fixtures in the seed", () => {
    const seed = source("prisma/seed.js");
    expect(seed).not.toMatch(/prisma\.classroom\.create/);
    expect(seed).not.toMatch(/prisma\.assignment\.create/);
    expect(seed).not.toMatch(/prisma\.assignmentSubmission\.create/);
    expect(seed).not.toMatch(/prisma\.assignmentProblemSubmission\.create/);
  });

  it("keeps only STUDENT and ADMIN in the application Role enum", () => {
    const schema = source("prisma/schema.prisma");
    const roleEnum = schema.slice(schema.indexOf("enum Role"), schema.indexOf("enum SkillType"));
    expect(roleEnum).toContain("STUDENT");
    expect(roleEnum).toContain("ADMIN");
    expect(roleEnum).not.toContain("TEACHER");
    expect(schema).toContain("model Classroom");
    expect(schema).toContain("model Assignment");
  });
});

describe("Phase 1C-A static authorization wiring", () => {
  it("guards the complete admin subtree at its layout", () => {
    const layout = source("src/app/admin/layout.tsx");
    expect(layout).toContain("requireContentAdmin");
    expect(layout).toContain("await requireContentAdmin()");
  });

  it("reloads role and email from the database instead of a cookie role claim", () => {
    const session = source("src/lib/auth/session.ts");
    const payload = session.slice(session.indexOf("type SessionPayload"), session.indexOf("export type CurrentUser"));
    expect(payload).toContain("userId");
    expect(payload).not.toContain("role");
    expect(session).toContain("prisma.user.findUnique");
    expect(session).toContain("role: true");
    expect(session).toContain("email: true");
  });

  it.each([
    "src/app/api/admin/contests-import/parse/route.ts",
    "src/app/api/admin/import/validate/route.ts",
    "src/app/api/admin/import/commit/route.ts",
    "src/app/api/admin/import/files/validate/route.ts",
    "src/app/api/admin/import/files/commit/route.ts",
  ])("uses the shared JSON API guard before rate limiting in %s", (file) => {
    const route = source(file);
    expect(route).toContain("requireContentAdminApi");
    expect(route.indexOf("requireContentAdminApi()")).toBeLessThan(
      route.indexOf("await checkConfiguredRateLimit("),
    );
    expect(route).not.toContain("redirect(");
  });

  it.each([
    "src/app/admin/actions.ts",
    "src/app/admin/content-packs/actions.ts",
    "src/app/admin/contests/actions.ts",
    "src/app/admin/contests-builder/actions.ts",
    "src/app/admin/diagnostic/actions.ts",
  ])("retains an action-local content-admin guard in %s", (file) => {
    expect(source(file)).toContain("requireAdmin");
  });

  it("has no legacy user-role privilege branch in production TypeScript", () => {
    const session = source("src/lib/auth/session.ts");
    const policy = source("src/lib/auth/content-admin-policy.ts");
    expect(session).not.toContain('role === "TEACHER"');
    expect(policy).not.toContain('role === "TEACHER"');
  });
});

describe("Phase 1C-A static classroom retirement wiring", () => {
  it("keeps every legacy Server Action as a repository-free tombstone", () => {
    for (const file of ["src/app/teacher/actions.ts", "src/app/teacher/grading/actions.ts"]) {
      const action = source(file);
      expect(action).toContain("retiredClassroomNotFound");
      expect(action).not.toContain("prisma");
      expect(action).not.toContain("@/lib/grading");
      expect(action).not.toContain("@/lib/classroom");
    }
  });

  it("returns a generic 404 from every assignment Route Handler method", () => {
    const route = source("src/app/api/assignments/[id]/submit/route.ts");
    expect(route).toContain("decideClassroomFeatureAccess");
    expect(route).not.toContain("prisma");
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(route).toContain(`export const ${method} = retiredResponse`);
    }
  });

  it.each([
    "src/app/classes/page.tsx",
    "src/app/classes/join/page.tsx",
    "src/app/assignments/[id]/page.tsx",
    "src/app/teacher/classes/page.tsx",
    "src/app/teacher/grading/page.tsx",
  ])("removes retired page %s so App Router returns not-found", (file) => {
    expect(fs.existsSync(path.join(process.cwd(), file))).toBe(false);
  });
});

describe("Phase 1C-A static portable import path wiring", () => {
  it("passes the selected input directory to readJson and uses the guarded resolver", () => {
    const importer = source("scripts/db-import-portable.ts");
    expect(importer).toContain("rows = readJson(opts.inputDir, step.name)");
    expect(importer).toContain("resolvePortableImportFile(dir, file)");
    expect(importer).toContain('name: "users.safe.json"');
    expect(importer).not.toContain("readJson(step.name, step.name)");
    expect(importer).toContain("row ${rowIndex + 1}: import rejected");
    expect(importer).not.toContain("console.error(error)");
  });
});

describe("Phase 1C-A static independent-practice persistence wiring", () => {
  it.each([
    ["src/app/api/submissions/route.ts", "prisma.submission.create"],
    ["src/app/api/submissions/route.ts", "prisma.userProblemStatus.upsert"],
    ["src/app/api/practice/random/route.ts", "prisma.submission.create"],
    ["src/lib/contests.ts", "tx.contestAttempt.create"],
    ["src/lib/diagnostic.ts", "tx.diagnosticAttempt.create"],
    ["src/lib/security/writing-quota.ts", "tx.writingSubmission.create"],
  ])("retains %s production persistence through %s", (file, call) => {
    expect(source(file)).toContain(call);
  });
});
