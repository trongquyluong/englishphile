import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportPlan, NormalizedProblem } from "@/lib/import/types";

const routeBoundaries = vi.hoisted(() => ({
  authorization: vi.fn(),
  origin: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/content-admin-api", () => ({ requireContentAdminApi: routeBoundaries.authorization }));
vi.mock("@/lib/security/request-origin", () => ({
  validateRequestOrigin: routeBoundaries.origin,
  getOriginErrorMessage: () => "Origin denied.",
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkConfiguredRateLimit: routeBoundaries.rateLimit,
  RATE_LIMITS: {
    IMPORT_COMMIT: (userId: string) => ({ action: "import-commit", subject: userId }),
    CONTENT_PACK_COMMIT: (userId: string) => ({ action: "content-pack-commit", subject: userId }),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST as commitManualImport } from "@/app/api/admin/import/commit/route";
import { POST as commitContentPackImport } from "@/app/api/admin/import/files/commit/route";
import { executeImportPlanAtomically } from "@/lib/import/atomic-import";
import { importJsonPayload } from "@/lib/import/json-importer";

const runPostgresIntegration = process.env.RUN_IMPORT_POSTGRES_INTEGRATION === "1";
const disposableConfirmation = "I_CONFIRM_THIS_IS_A_DISPOSABLE_IMPORT_TEST_DATABASE";
const fixturePrefix = `epit-${randomUUID().replaceAll("-", "")}`;
const fixtureValue = (suffix: string) => `${fixturePrefix}-${suffix}`;

type DisposableDatabaseTarget = {
  kind: "pglite";
  databaseName: string;
  schemaName: string | null;
};

function disposableDatabaseTarget(environment: Record<string, string | undefined>): DisposableDatabaseTarget {
  if (environment.RUN_IMPORT_POSTGRES_INTEGRATION !== "1") {
    throw new Error("PostgreSQL import integration is not explicitly enabled.");
  }
  if (environment.CONFIRM_DISPOSABLE_IMPORT_DATABASE !== disposableConfirmation) {
    throw new Error("Disposable import database confirmation is missing.");
  }
  if (environment.NODE_ENV !== "test") {
    throw new Error("PostgreSQL import integration requires test mode.");
  }

  let parsed: URL;
  try {
    parsed = new URL(environment.DATABASE_URL ?? "");
  } catch {
    throw new Error("Disposable import database configuration is invalid.");
  }
  if (!(["postgres:", "postgresql:"] as string[]).includes(parsed.protocol)) {
    throw new Error("Disposable import database must use PostgreSQL.");
  }

  const host = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Disposable import database must be local loopback.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const schemaName = parsed.searchParams.get("schema");
  const targetIdentity = `${host}/${databaseName}/${schemaName ?? ""}`.toLowerCase();
  if (/(^|[^a-z0-9])(preview|prod|production|neon|vercel)([^a-z0-9]|$)/.test(targetIdentity)) {
    throw new Error("Preview and Production database targets are forbidden.");
  }

  if (environment.IMPORT_POSTGRES_TEST_ENGINE !== "pglite") {
    throw new Error("Disposable import database must declare PGlite.");
  }
  return { kind: "pglite", databaseName, schemaName };
}

async function verifyDisposableDatabase(target: DisposableDatabaseTarget) {
  let stage = "identity-query";
  try {
    const rows = await prisma.$queryRaw<Array<{
      version: string;
      databaseName: string;
      schemaName: string;
    }>>`
      SELECT
        version() AS "version",
        current_database() AS "databaseName",
        current_schema() AS "schemaName"
    `;
    stage = "identity-value";
    const identity = rows[0];
    if (!identity) throw new Error("identity");
    if (!/(pglite|wasm|emscripten)/i.test(identity.version)) throw new Error("identity");
    if (
      identity.databaseName !== target.databaseName ||
      (target.schemaName !== null && identity.schemaName !== target.schemaName)
    ) throw new Error("identity");

    stage = "application-table-enumeration";
    const applicationTables = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
    `;
    stage = "application-table-emptiness";
    for (const { tableName } of applicationTables) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tableName)) throw new Error("schema");
      const tableRows = await prisma.$queryRawUnsafe<Array<{ hasRows: boolean }>>(
        `SELECT EXISTS (SELECT 1 FROM "${tableName}" LIMIT 1) AS "hasRows"`,
      );
      if (tableRows[0]?.hasRows) throw new Error("rows");
    }
  } catch {
    throw new Error(`Disposable database guard failed at ${stage}.`);
  }
}

async function expectApplicationTablesEmpty() {
  const applicationTables = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;
  const rowPresence: boolean[] = [];
  for (const { tableName } of applicationTables) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tableName)) {
      throw new Error("Disposable import database schema is invalid.");
    }
    const rows = await prisma.$queryRawUnsafe<Array<{ hasRows: boolean }>>(
      `SELECT EXISTS (SELECT 1 FROM "${tableName}" LIMIT 1) AS "hasRows"`,
    );
    rowPresence.push(rows[0]?.hasRows === true);
  }
  expect(rowPresence.some(Boolean)).toBe(false);
}

function syntheticProblem(slug: string, topicNames = [fixtureValue("topic")]): NormalizedProblem {
  return {
    title: `Synthetic problem ${slug}`,
    slug,
    skillType: "MULTIPLE_CHOICE",
    questionType: "MCQ",
    difficulty: "B2",
    sourceCollection: {
      name: fixtureValue("source"),
      description: "Synthetic source description",
      sourceType: "JSON",
    },
    statement: "Synthetic statement",
    topics: topicNames,
    questions: [{
      type: "MCQ",
      skillType: "MULTIPLE_CHOICE",
      difficulty: "B2",
      prompt: "Synthetic prompt",
      options: [{ id: "A", text: "Synthetic option A" }, { id: "B", text: "Synthetic option B" }],
      answer: { correctOptionId: "A" },
      orderIndex: 0,
    }],
    orderIndex: 0,
  };
}

function syntheticPlan(problems: NormalizedProblem[]): ImportPlan {
  return {
    ok: true,
    importType: "JSON",
    summary: {
      sourceCollectionsToCreate: 1,
      sourceCollectionsReused: 0,
      topicsToCreate: new Set(problems.flatMap((problem) => problem.topics)).size,
      topicsReused: 0,
      problemsToCreate: problems.length,
      questionsToCreate: problems.reduce((total, problem) => total + problem.questions.length, 0),
      duplicateProblemsSkipped: 0,
      duplicateQuestionsSkipped: 0,
      exactDuplicateQuestionsSkipped: 0,
      highSimilarityQuestionsSkipped: 0,
      possibleDuplicateQuestionsFlagged: 0,
      problemsImported: 0,
      questionsImported: 0,
      errors: 0,
      warnings: 0,
    },
    issues: [],
    preview: [],
    payload: { importType: "JSON", problems },
  };
}

function syntheticJsonImport(
  sourceName = fixtureValue("source"),
  topicNames = [fixtureValue("topic")],
  slug = fixtureValue("problem"),
) {
  return JSON.stringify({
    sourceCollection: {
      name: sourceName,
      description: "Synthetic source description",
      sourceType: "JSON",
    },
    problems: [{
      title: "Synthetic problem",
      slug,
      skillType: "MULTIPLE_CHOICE",
      questionType: "MCQ",
      difficulty: "B2",
      statement: "Synthetic statement",
      topics: topicNames,
      questions: [{
        type: "MCQ",
        skillType: "MULTIPLE_CHOICE",
        difficulty: "B2",
        prompt: "Synthetic prompt",
        options: [{ id: "A", text: "Synthetic option A" }, { id: "B", text: "Synthetic option B" }],
        answer: { correctOptionId: "A" },
      }],
    }],
  });
}

async function ownedFixtureIds() {
  const [problems, topics, sources] = await Promise.all([
    prisma.problem.findMany({ where: { slug: { startsWith: fixturePrefix } }, select: { id: true } }),
    prisma.topic.findMany({ where: { slug: { startsWith: fixturePrefix } }, select: { id: true } }),
    prisma.sourceCollection.findMany({ where: { name: { startsWith: fixturePrefix } }, select: { id: true } }),
  ]);
  return {
    problemIds: problems.map(({ id }) => id),
    topicIds: topics.map(({ id }) => id),
    sourceIds: sources.map(({ id }) => id),
  };
}

async function clearOwnedImportFixture() {
  const { problemIds, topicIds, sourceIds } = await ownedFixtureIds();
  await prisma.problemTopic.deleteMany({
    where: { OR: [{ problemId: { in: problemIds } }, { topicId: { in: topicIds } }] },
  });
  await prisma.question.deleteMany({ where: { problemId: { in: problemIds } } });
  await prisma.problem.deleteMany({ where: { id: { in: problemIds } } });
  await prisma.importBatch.deleteMany({ where: { userId: { startsWith: fixturePrefix } } });
  await prisma.contentPack.deleteMany({ where: { importedById: { startsWith: fixturePrefix } } });
  await prisma.topic.deleteMany({ where: { id: { in: topicIds } } });
  await prisma.sourceCollection.deleteMany({ where: { id: { in: sourceIds } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: fixturePrefix } } });
}

async function expectNoOwnedFixtureRows() {
  const counts = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: fixturePrefix } } }),
    prisma.sourceCollection.count({ where: { name: { startsWith: fixturePrefix } } }),
    prisma.topic.count({ where: { slug: { startsWith: fixturePrefix } } }),
    prisma.contentPack.count({ where: { importedById: { startsWith: fixturePrefix } } }),
    prisma.importBatch.count({ where: { userId: { startsWith: fixturePrefix } } }),
    prisma.problem.count({ where: { slug: { startsWith: fixturePrefix } } }),
    prisma.question.count({ where: { problem: { slug: { startsWith: fixturePrefix } } } }),
    prisma.problemTopic.count({
      where: {
        OR: [
          { problem: { slug: { startsWith: fixturePrefix } } },
          { topic: { slug: { startsWith: fixturePrefix } } },
        ],
      },
    }),
  ]);
  expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
}

describe("disposable PostgreSQL import integration guard", () => {
  const baseEnvironment = {
    RUN_IMPORT_POSTGRES_INTEGRATION: "1",
    CONFIRM_DISPOSABLE_IMPORT_DATABASE: disposableConfirmation,
    NODE_ENV: "test",
  };

  it("accepts an explicitly confirmed local PGlite candidate for runtime engine verification", () => {
    expect(disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:55439/postgres",
      IMPORT_POSTGRES_TEST_ENGINE: "pglite",
    })).toEqual({ kind: "pglite", databaseName: "postgres", schemaName: null });
  });

  it("rejects a named local database that is not runtime-declared PGlite", () => {
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@localhost:5432/englishphile_import_test_run1",
    })).toThrow("Disposable import database must declare PGlite.");
  });

  it("rejects a missing disposable confirmation", () => {
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      CONFIRM_DISPOSABLE_IMPORT_DATABASE: undefined,
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:55439/postgres",
      IMPORT_POSTGRES_TEST_ENGINE: "pglite",
    })).toThrow("Disposable import database confirmation is missing.");
  });

  it("rejects remote and Neon targets even when explicitly confirmed", () => {
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@remote.example/englishphile_import_test_run1",
    })).toThrow("Disposable import database must be local loopback.");
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@example.neon.tech/englishphile_import_test_run1",
    })).toThrow("Disposable import database must be local loopback.");
  });

  it("rejects ordinary local development and Production-named databases", () => {
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:5432/englishphile",
    })).toThrow("Disposable import database must declare PGlite.");
    expect(() => disposableDatabaseTarget({
      ...baseEnvironment,
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:5432/englishphile_import_test_production",
      IMPORT_POSTGRES_TEST_ENGINE: "pglite",
    })).toThrow("Preview and Production database targets are forbidden.");
  });
});

describe.skipIf(!runPostgresIntegration).sequential(
  "atomic import against isolated PostgreSQL",
  () => {
    let databaseSafetyVerified = false;

    beforeAll(async () => {
      let stage = "configuration";
      try {
        const target = disposableDatabaseTarget(process.env);
        stage = "read-only-database-verification";
        await verifyDisposableDatabase(target);
        databaseSafetyVerified = true;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Disposable database guard failed at ")) {
          throw error;
        }
        throw new Error(`Disposable integration guard failed at ${stage}.`);
      }
    });

    beforeEach(async () => {
      if (!databaseSafetyVerified) throw new Error("Disposable import database safety verification did not complete.");
      await expectNoOwnedFixtureRows();
      await prisma.user.create({
        data: {
          id: fixtureValue("admin"),
          email: `${fixtureValue("admin")}@integration.invalid`,
          passwordHash: "synthetic-password-hash",
          displayName: "Synthetic Admin",
          role: "ADMIN",
        },
      });
      routeBoundaries.authorization.mockResolvedValue({
        authorized: true,
        user: {
          id: fixtureValue("admin"),
          email: `${fixtureValue("admin")}@integration.invalid`,
          role: "ADMIN",
        },
      });
      routeBoundaries.origin.mockResolvedValue({ valid: true });
      routeBoundaries.rateLimit.mockResolvedValue({ status: "allowed" });
    });

    afterEach(async () => {
      try {
        if (databaseSafetyVerified) {
          await clearOwnedImportFixture();
          await expectNoOwnedFixtureRows();
          await expectApplicationTablesEmpty();
        }
      } finally {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
      }
    });

    afterAll(async () => {
      if (runPostgresIntegration) {
        if (databaseSafetyVerified) {
          await clearOwnedImportFixture();
          await expectNoOwnedFixtureRows();
          await expectApplicationTablesEmpty();
        }
        await prisma.$disconnect();
      }
    });

    it("creates a missing source and two missing topics before the nested problem write", async () => {
      const result = await importJsonPayload(
        syntheticJsonImport(fixtureValue("source"), [fixtureValue("topic-a"), fixtureValue("topic-b")]),
        fixtureValue("admin"),
      );

      expect(result.status).toBe("IMPORTED");
      await expect(prisma.sourceCollection.count()).resolves.toBe(1);
      await expect(prisma.topic.count()).resolves.toBe(2);
      await expect(prisma.importBatch.count()).resolves.toBe(1);
      await expect(prisma.problem.count()).resolves.toBe(1);
      await expect(prisma.question.count()).resolves.toBe(1);
      await expect(prisma.problemTopic.count()).resolves.toBe(2);
    });

    it("reuses an existing source and topic", async () => {
      const source = await prisma.sourceCollection.create({
        data: { name: fixtureValue("source"), description: "Existing synthetic source", sourceType: "JSON" },
      });
      const topic = await prisma.topic.create({
        data: { name: fixtureValue("topic"), slug: fixtureValue("topic") },
      });

      await importJsonPayload(syntheticJsonImport(), fixtureValue("admin"));

      await expect(prisma.sourceCollection.count()).resolves.toBe(1);
      await expect(prisma.topic.count()).resolves.toBe(1);
      const problem = await prisma.problem.findUniqueOrThrow({
        where: { slug: fixtureValue("problem") },
        select: { sourceCollectionId: true, problemTopics: { select: { topicId: true } } },
      });
      expect(problem.sourceCollectionId).toBe(source.id);
      expect(problem.problemTopics).toEqual([{ topicId: topic.id }]);
    });

    it("reuses existing taxonomy and creates only the missing topic", async () => {
      await prisma.sourceCollection.create({
        data: { name: fixtureValue("source"), description: "Existing synthetic source", sourceType: "JSON" },
      });
      await prisma.topic.create({
        data: { name: fixtureValue("topic-a"), slug: fixtureValue("topic-a") },
      });

      await importJsonPayload(
        syntheticJsonImport(fixtureValue("source"), [fixtureValue("topic-a"), fixtureValue("topic-b")]),
        fixtureValue("admin"),
      );

      await expect(prisma.sourceCollection.count()).resolves.toBe(1);
      await expect(prisma.topic.count()).resolves.toBe(2);
      await expect(prisma.problemTopic.count()).resolves.toBe(2);
    });

    it("commits the manual route through the production handler", async () => {
      const response = await commitManualImport(new Request("http://integration.invalid/api/admin/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importType: "JSON", content: syntheticJsonImport() }),
      }));

      expect(response.status).toBe(200);
      await expect(prisma.problem.count()).resolves.toBe(1);
      await expect(prisma.question.count()).resolves.toBe(1);
    });

    it("commits upload-first content through the production route and reconciles its pack", async () => {
      const response = await commitContentPackImport(new Request("http://integration.invalid/api/admin/import/files/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: [{ fileName: `${fixtureValue("01")}.json`, content: syntheticJsonImport() }],
        }),
      }));

      expect(response.status).toBe(200);
      await expect(prisma.contentPack.count({ where: { status: "IMPORTED" } })).resolves.toBe(1);
      await expect(prisma.importBatch.count({ where: { status: "IMPORTED" } })).resolves.toBe(1);
      await expect(prisma.problem.count()).resolves.toBe(1);
      await expect(prisma.question.count()).resolves.toBe(1);
    });

    it("authorizes a normalized OWNER_EMAIL learner inside the transaction", async () => {
      await prisma.user.create({
        data: {
          id: fixtureValue("owner"),
          email: `${fixtureValue("owner")}@integration.invalid`,
          passwordHash: "synthetic-password-hash",
          displayName: "Synthetic Owner",
          role: "STUDENT",
        },
      });
      vi.stubEnv("OWNER_EMAIL", ` ${fixtureValue("owner").toUpperCase()}@integration.invalid `);

      const result = await importJsonPayload(syntheticJsonImport(), fixtureValue("owner"));

      expect(result.status).toBe("IMPORTED");
      await expect(prisma.problem.count()).resolves.toBe(1);
    });

    it("serializes missing taxonomy creation across two distinct admin principals", async () => {
      await prisma.user.create({
        data: {
          id: fixtureValue("admin-two"),
          email: `${fixtureValue("admin-two")}@integration.invalid`,
          passwordHash: "synthetic-password-hash",
          displayName: "Synthetic Admin Two",
          role: "ADMIN",
        },
      });

      const [first, second] = await Promise.all([
        importJsonPayload(
          syntheticJsonImport(fixtureValue("source"), [fixtureValue("topic")], fixtureValue("one")),
          fixtureValue("admin"),
        ),
        importJsonPayload(
          syntheticJsonImport(fixtureValue("source"), [fixtureValue("topic")], fixtureValue("two")),
          fixtureValue("admin-two"),
        ),
      ]);

      expect([first.status, second.status]).toEqual(["IMPORTED", "IMPORTED"]);
      await expect(prisma.sourceCollection.count()).resolves.toBe(1);
      await expect(prisma.topic.count()).resolves.toBe(1);
      await expect(prisma.problem.count()).resolves.toBe(2);
      await expect(prisma.question.count()).resolves.toBe(2);
      await expect(prisma.problemTopic.count()).resolves.toBe(2);
    });

    it("rolls back taxonomy, batch, problem, question, and join rows after a later failure", async () => {
      const first = syntheticProblem(fixtureValue("one"));
      const second = syntheticProblem(fixtureValue("two"));
      second.questions[0].answer = BigInt(1);
      const sink = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(executeImportPlanAtomically(syntheticPlan([first, second]), {
        importType: "JSON",
        userId: fixtureValue("admin"),
        contentStatus: "NEEDS_REVIEW",
      })).rejects.toBeInstanceOf(TypeError);

      expect(sink).toHaveBeenCalledWith("Import commit failed.", {
        action: "import-commit",
        errorClass: "validation",
        stage: "problem-nested-create",
        prismaErrorKind: "not-prisma",
        prismaCode: "unknown",
      });
      await expect(prisma.sourceCollection.count()).resolves.toBe(0);
      await expect(prisma.topic.count()).resolves.toBe(0);
      await expect(prisma.importBatch.count()).resolves.toBe(0);
      await expect(prisma.problem.count()).resolves.toBe(0);
      await expect(prisma.question.count()).resolves.toBe(0);
      await expect(prisma.problemTopic.count()).resolves.toBe(0);
    });
  },
);
