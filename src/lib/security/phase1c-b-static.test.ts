import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Phase 1C-B static structural checks (not runtime authorization or PostgreSQL integration)", () => {
  it("wires every contest builder child action to a scoped production helper", () => {
    const source = read("src/app/admin/contests-builder/actions.ts");
    for (const helper of [
      "createContestSection(",
      "createContestSectionWithQuestions(",
      "updateContestSection(",
      "deleteContestSection(",
      "createContestQuestion(",
      "updateContestQuestion(",
      "deleteContestQuestion(",
    ]) {
      expect(source).toContain(helper);
    }
    expect(source).not.toMatch(/contestSection\.(update|delete)\(\{[\s\S]*?where:\s*\{\s*id:/);
    expect(source).not.toMatch(/contestQuestion\.(update|delete)\(\{[\s\S]*?where:\s*\{\s*id:/);
  });

  it("uses relation-scoped child predicates in the production helper", () => {
    const source = read("src/lib/admin/contest-mutations.ts");
    expect(source).toContain("where: { id: sectionId, contestId }");
    expect(source).toContain('where: { id: questionId, section: { contestId } }');
  });

  it("locks parent rows with parameterized Prisma tagged templates", () => {
    const source = read("src/lib/admin/mutation-locks.ts");
    expect(source).toContain('WHERE "id" = ${contestId}');
    expect(source).toContain("Prisma.join(problemIds)");
    expect(source).toContain("ORDER BY \"id\"");
    expect(source).toContain("FOR UPDATE");
    expect(source).not.toContain("$queryRawUnsafe");
  });

  it("publishes contests only through the locked atomic helper", () => {
    const source = read("src/app/admin/contests-builder/actions.ts");
    expect(source).toContain("publishContestAtomically(contestId, user.id)");
    expect(source).not.toMatch(/publishContestAction[\s\S]*?prisma\.contest\.update\(/);
  });

  it("scopes question writes by problem and keeps problem/audit updates transactional", () => {
    const questions = read("src/lib/admin/questions.ts");
    const problems = read("src/lib/admin/problems.ts");
    expect(questions).toContain("where: { id: payload.id, problemId }");
    expect(questions).toContain("}, tx);");
    expect(problems).toContain("return prisma.$transaction(async (tx) =>");
    expect(problems).toContain("lockProblemsForAdminMutation");
  });

  it("routes JSON and CSV successful commits through the atomic import helper", () => {
    expect(read("src/lib/import/json-importer.ts")).toContain("executeImportPlanAtomically(plan");
    expect(read("src/lib/import/csv-importer.ts")).toContain("executeImportPlanAtomically(plan");
    const helper = read("src/lib/import/atomic-import.ts");
    expect(helper).toContain('status: "VALIDATED"');
    expect(helper).toContain('status: "IMPORTED"');
  });

  it("retains action-local authorization before scoped resource helpers", () => {
    const source = read("src/app/admin/contests-builder/actions.ts");
    for (const action of ["updateSectionAction", "deleteSectionAction", "createQuestionAction", "updateQuestionAction", "deleteQuestionAction", "publishContestAction"]) {
      const start = source.indexOf(`function ${action}`);
      expect(start).toBeGreaterThan(-1);
      expect(source.slice(start, start + 260)).toContain("await requireAdmin()");
    }
  });

  it("revalidates the current content-admin principal inside mutation transactions", () => {
    const guardedFiles = [
      "src/lib/admin/contest-mutations.ts",
      "src/lib/admin/problems.ts",
      "src/lib/admin/sources.ts",
      "src/lib/admin/topics.ts",
      "src/lib/contests.ts",
      "src/lib/import/atomic-import.ts",
      "src/lib/content-packs/importer.ts",
      "src/app/admin/contests-builder/actions.ts",
      "src/app/admin/content-packs/actions.ts",
      "src/app/admin/diagnostic/actions.ts",
    ];
    for (const file of guardedFiles) {
      expect(read(file)).toContain("requireContentAdminInTransaction");
    }
    const guard = read("src/lib/auth/content-admin-transaction.ts");
    expect(guard).toContain('FROM "User"');
    expect(guard).toContain("FOR UPDATE");
    expect(guard).toContain("isContentAdminIdentity");
    expect(guard).not.toContain("$queryRawUnsafe");
  });

  it("rechecks content-pack membership and uses set-based bounded status writes", () => {
    const problems = read("src/lib/admin/problems.ts");
    expect(problems).toContain("target.contentPackId !== options.contentPackId");
    expect(problems).toContain("MAX_ADMIN_BULK_QUESTIONS");
    expect(problems).toContain("tx.problem.updateMany");
    expect(problems).toContain("tx.contentAuditLog.createMany");
    expect(problems).not.toContain("for (const id of parsed.ids)");
  });

  it("persists digest-bound unique content-pack entries and reconciles linked batches", () => {
    const importer = read("src/lib/content-packs/importer.ts");
    const execution = read("src/lib/content-packs/execution.ts");
    const identity = read("src/lib/content-packs/file-identity.ts");
    expect(importer).toContain("buildContentPackExecutionManifest");
    expect(importer).toContain("resumeContentPackId");
    expect(importer).toContain("pendingFiles > 0");
    expect(execution).toContain("executionPlan");
    expect(execution).toContain("tx.importBatch.findMany");
    expect(execution).toContain("contentPackFileIdentityKey");
    expect(identity).toContain('createHash("sha256")');
    expect(identity).toContain('update(content, "utf8")');
  });

  it("does not expose the internal content-pack resume primitive through the active commit API", () => {
    const route = read("src/app/api/admin/import/files/commit/route.ts");
    expect(route).toContain("importContentPackFiles(files, user.id");
    expect(route).not.toContain("resumeContentPackId");
  });

  it("bounds section placeholder creation before Array.from and the transaction helper", () => {
    const source = read("src/app/admin/contests-builder/actions.ts");
    const policy = read("src/lib/admin/contest-section-placeholders.ts");
    const action = source.slice(source.indexOf("export async function createSectionWithQuestionsAction"));
    expect(policy).toContain("MAX_CONTEST_SECTION_PLACEHOLDER_QUESTIONS = 100");
    expect(source).toContain('from "@/lib/admin/contest-section-placeholders"');
    expect(action.indexOf("parseContestSectionPlaceholderCount")).toBeLessThan(action.indexOf("Array.from"));
    expect(action.indexOf("redirectBack(")).toBeLessThan(action.indexOf("createContestSectionWithQuestions("));
  });

  it("preserves API content-admin checks before parsing and rate limiting", () => {
    for (const file of [
      "src/app/api/admin/import/commit/route.ts",
      "src/app/api/admin/import/files/commit/route.ts",
      "src/app/api/admin/import/validate/route.ts",
      "src/app/api/admin/import/files/validate/route.ts",
      "src/app/api/admin/contests-import/parse/route.ts",
    ]) {
      const source = read(file);
      const auth = source.indexOf("requireContentAdminApi()");
      expect(auth).toBeGreaterThan(-1);
      expect(auth).toBeLessThan(source.indexOf("checkConfiguredRateLimit(", auth));
      const parse = [source.indexOf("request.json()", auth), source.indexOf("req.formData()", auth)].find((index) => index >= 0) ?? -1;
      expect(parse).toBeGreaterThan(-1);
      expect(auth).toBeLessThan(parse);
    }
  });
});
