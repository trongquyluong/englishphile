#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const loopbackAddress = "127.0.0.1";
const disposableConfirmation = "I_CONFIRM_THIS_IS_A_DISPOSABLE_IMPORT_TEST_DATABASE";
const expectedPgliteVersion = "0.4.3";
const expectedSocketVersion = "0.1.3";
const expectedPgVersion = "8.16.3";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(repositoryRoot, "prisma", "migrations");
const vitestCli = path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
const integrationTest = "src/lib/import/atomic-import.postgres.test.ts";
const outputLimit = 512 * 1024;

let ownedServer = null;
let activeChild = null;
let interruptedExitCode = null;
let reportDirectory = null;

function appendBounded(current, chunk) {
  if (current.length >= outputLimit) return current;
  return (current + chunk.toString("utf8")).slice(0, outputLimit);
}

function safeChildFailureClass(output) {
  if (output.trim().length === 0) return "silent-process";
  if (/guard failed at configuration/i.test(output)) return "vitest-configuration-guard";
  if (/guard failed at read-only-database-verification/i.test(output)) return "vitest-database-guard";
  if (/database guard failed at identity-query/i.test(output)) return "vitest-identity-query";
  if (/database guard failed at identity-value/i.test(output)) return "vitest-identity-value";
  if (/database guard failed at application-table-enumeration/i.test(output)) return "vitest-table-enumeration";
  if (/database guard failed at application-table-emptiness/i.test(output)) return "vitest-table-emptiness";
  if (/P1001|could not connect|can't reach|connection|ECONN/i.test(output)) return "connection";
  if (/unknown (?:or unexpected )?option|unknown command|usage:/i.test(output)) return "invocation";
  if (/ENOENT|no such file|cannot find/i.test(output)) return "filesystem";
  if (/environment|datasource|database url/i.test(output)) return "configuration";
  if (/P\d{4}|database error|syntax error|migration/i.test(output)) return "database";
  return "process";
}

async function findRandomLoopbackPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, loopbackAddress, resolve);
  });
  const address = reservation.address();
  if (!address || typeof address === "string") {
    reservation.close();
    throw new Error("Disposable integration port reservation failed.");
  }
  await new Promise((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function resolvePinnedPgliteServer() {
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const binDirectory of pathEntries) {
    const packageRoot = path.resolve(binDirectory, "..");
    const socketRoot = path.join(packageRoot, "@electric-sql", "pglite-socket");
    const serverScript = path.join(socketRoot, "dist", "scripts", "server.js");
    try {
      await access(serverScript);
      const [socketPackage, pglitePackage, pgPackage] = await Promise.all([
        readFile(path.join(socketRoot, "package.json"), "utf8").then(JSON.parse),
        readFile(path.join(packageRoot, "@electric-sql", "pglite", "package.json"), "utf8").then(JSON.parse),
        readFile(path.join(packageRoot, "pg", "package.json"), "utf8").then(JSON.parse),
      ]);
      if (
        socketPackage.version !== expectedSocketVersion ||
        pglitePackage.version !== expectedPgliteVersion ||
        pgPackage.version !== expectedPgVersion
      ) {
        throw new Error("Transient PGlite package versions are not approved.");
      }
      const pgModule = await import(pathToFileURL(path.join(packageRoot, "pg", "lib", "index.js")).href);
      const PgClient = pgModule.Client ?? pgModule.default?.Client;
      if (typeof PgClient !== "function") throw new Error("Pinned transient PostgreSQL client is unavailable.");
      return { serverScript, PgClient };
    } catch (error) {
      if (error instanceof Error && error.message === "Transient PGlite package versions are not approved.") {
        throw error;
      }
    }
  }
  throw new Error("Pinned transient PGlite packages are unavailable.");
}

function createDisposableTarget(port) {
  const target = new URL("postgresql://integration:integration@127.0.0.1/postgres");
  target.port = String(port);
  target.searchParams.set("sslmode", "disable");
  target.searchParams.set("connection_limit", "1");
  return target.toString();
}

function createChildEnvironment(databaseUrl) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: "test",
    RUN_IMPORT_POSTGRES_INTEGRATION: "1",
    CONFIRM_DISPOSABLE_IMPORT_DATABASE: disposableConfirmation,
    IMPORT_POSTGRES_TEST_ENGINE: "pglite",
    OWNER_EMAIL: "",
  };
}

async function stopOwnedChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    throw new Error("Disposable child process did not stop.");
  }
}

function runCaptured(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    activeChild = child;
    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.once("error", () => reject(new Error(`${options.stage ?? "Child process"} could not start.`)));
    child.once("close", (code, signal) => {
      activeChild = null;
      if (code === 0 && signal === null) resolve({ success: true, stdout, stderr });
      else {
        const errorClass = safeChildFailureClass(`${stdout}\n${stderr}`);
        if (options.returnFailure) {
          resolve({ success: false, stdout, stderr, errorClass });
          return;
        }
        const exitKind = code === null ? "signal" : `exit-${code}`;
        reject(new Error(`${options.stage ?? "Child process"} failed (${errorClass}, ${exitKind}).`));
      }
    });
  });
}

async function startOwnedPglite(serverScript, port) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [
    serverScript,
    "--db=memory://",
    `--host=${loopbackAddress}`,
    `--port=${port}`,
    "--max-connections=10",
  ], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => {
    stdout = appendBounded(stdout, chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr = appendBounded(stderr, chunk);
  });
  try {
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", () => reject(new Error("Disposable PGlite process could not start.")));
    });

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error("Disposable PGlite process exited before verification.");
      }
      if (stdout.includes("PGlite database initialized") && stdout.includes("PGLiteSocketServer listening")) {
        return child;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    void stderr;
    throw new Error("Disposable PGlite process did not become ready.");
  } catch (error) {
    await stopOwnedChild(child);
    throw error;
  }
}

async function withPgClient(databaseUrl, PgClient, callback) {
  const client = new PgClient({ connectionString: databaseUrl, ssl: false });
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function verifyOwnedDisposableTarget(databaseUrl, server, PgClient) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== loopbackAddress || server.exitCode !== null || server.signalCode !== null) {
    throw new Error("Disposable PGlite ownership verification failed.");
  }

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await withPgClient(databaseUrl, PgClient, async (client) => {
        const identityResult = await client.query(
          'SELECT version() AS "version", current_database() AS "databaseName", current_schema() AS "schemaName"',
        );
        const identity = identityResult.rows[0];
        if (!identity || !/(pglite|wasm|emscripten)/i.test(identity.version)) {
          throw new Error("Runtime database engine is not disposable PGlite.");
        }
        if (identity.databaseName !== "postgres" || identity.schemaName !== "public") {
          throw new Error("Disposable PGlite identity is unexpected.");
        }
        const tableResult = await client.query(
          `SELECT COUNT(*)::int AS "count"
           FROM information_schema.tables
           WHERE table_schema = current_schema()
             AND table_type = 'BASE TABLE'`,
        );
        if (tableResult.rows[0]?.count !== 0) {
          throw new Error("Disposable PGlite target is not fresh.");
        }
      });
      return;
    } catch {
      if (server.exitCode !== null || server.signalCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Disposable PGlite read-only verification failed.");
}

async function currentMigrationFiles() {
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const migrations = [];
  for (const name of directories) {
    const file = path.join(migrationDirectory, name, "migration.sql");
    await access(file);
    migrations.push({ name, file });
  }
  if (migrations.length === 0) throw new Error("Repository migration chain is empty.");
  return migrations;
}

async function applyCompleteMigrationChain(databaseUrl, PgClient) {
  const migrations = await currentMigrationFiles();
  const applied = [];
  const client = new PgClient({ connectionString: databaseUrl, ssl: false });
  try {
    await client.connect();
    for (const [index, migration] of migrations.entries()) {
      const sql = await readFile(migration.file, "utf8");
      try {
        await client.query(sql);
      } catch {
        throw new Error(`Current migration chain item ${index + 1} failed safely.`);
      }
      applied.push(migration.name);
      console.log(`Applied current migration ${applied.length}/${migrations.length}.`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
  if (JSON.stringify(applied) !== JSON.stringify(migrations.map(({ name }) => name))) {
    throw new Error("Complete migration chain did not run in order.");
  }
}

async function verifyCurrentSchema(databaseUrl, PgClient) {
  await withPgClient(databaseUrl, PgClient, async (client) => {
    const tableResult = await client.query(
      `SELECT table_name AS "tableName"
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name IN (
           'User', 'SourceCollection', 'Topic', 'ImportBatch', 'ContentPack',
           'Problem', 'Question', 'ProblemTopic', 'WritingSubmission',
           'ContestSection', 'ContestQuestion', 'RateLimitBucket',
           'ContestAccessGrant', 'WritingQuotaReservation'
         )
       ORDER BY table_name`,
    );
    const requiredTables = [
      "ContentPack", "ContestAccessGrant", "ContestQuestion", "ContestSection", "ImportBatch",
      "Problem", "ProblemTopic", "Question", "RateLimitBucket", "SourceCollection", "Topic", "User",
      "WritingQuotaReservation", "WritingSubmission",
    ];
    if (JSON.stringify(tableResult.rows.map((row) => row.tableName)) !== JSON.stringify(requiredTables)) {
      throw new Error("Disposable database does not contain the current table shape.");
    }

    const columnResult = await client.query(
      `SELECT column_name AS "columnName"
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'Contest'
         AND column_name IN ('accessCode', 'accessCodeUpdatedAt')
       ORDER BY column_name`,
    );
    if (JSON.stringify(columnResult.rows.map((row) => row.columnName)) !== JSON.stringify(["accessCode", "accessCodeUpdatedAt"])) {
      throw new Error("Disposable database does not contain the current contest shape.");
    }

    const roleResult = await client.query(
      `SELECT enumlabel AS "label"
       FROM pg_enum
       JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE pg_type.typname = 'Role'
       ORDER BY enumsortorder`,
    );
    if (JSON.stringify(roleResult.rows.map((row) => row.label)) !== JSON.stringify(["STUDENT", "ADMIN"])) {
      throw new Error("Disposable database does not contain the current role policy.");
    }
  });
}

async function run() {
  const port = await findRandomLoopbackPort();
  const { serverScript, PgClient } = await resolvePinnedPgliteServer();
  const databaseUrl = createDisposableTarget(port);
  const childEnvironment = createChildEnvironment(databaseUrl);

  try {
    ownedServer = await startOwnedPglite(serverScript, port);
    await verifyOwnedDisposableTarget(databaseUrl, ownedServer, PgClient);
    console.log("Owned disposable PGlite verified before schema changes.");

    await applyCompleteMigrationChain(databaseUrl, PgClient);
    await verifyCurrentSchema(databaseUrl, PgClient);
    console.log("Complete current migration chain verified.");

    reportDirectory = await mkdtemp(path.join(tmpdir(), "englishphile-import-integration-"));
    const configFile = path.join(reportDirectory, "vitest.config.mjs");
    const setupFile = path.join(reportDirectory, "vitest.setup.mjs");
    await writeFile(setupFile, [
      `process.env.DATABASE_URL = ${JSON.stringify(databaseUrl)};`,
      `process.env.DIRECT_URL = ${JSON.stringify(databaseUrl)};`,
      'process.env.RUN_IMPORT_POSTGRES_INTEGRATION = "1";',
      `process.env.CONFIRM_DISPOSABLE_IMPORT_DATABASE = ${JSON.stringify(disposableConfirmation)};`,
      'process.env.IMPORT_POSTGRES_TEST_ENGINE = "pglite";',
      'process.env.NODE_ENV = "test";',
      "",
    ].join("\n"), "utf8");
    const integrationConfig = {
      test: {
        globals: true,
        environment: "node",
        include: [integrationTest],
        pool: "forks",
        setupFiles: [setupFile],
        env: {
          DATABASE_URL: databaseUrl,
          DIRECT_URL: databaseUrl,
          RUN_IMPORT_POSTGRES_INTEGRATION: "1",
          CONFIRM_DISPOSABLE_IMPORT_DATABASE: disposableConfirmation,
          IMPORT_POSTGRES_TEST_ENGINE: "pglite",
          NODE_ENV: "test",
        },
      },
      resolve: {
        alias: { "@": path.join(repositoryRoot, "src") },
      },
    };
    await writeFile(configFile, `export default ${JSON.stringify(integrationConfig)};\n`, "utf8");
    await runCaptured(process.execPath, [
      "-e",
      `if (process.env.RUN_IMPORT_POSTGRES_INTEGRATION !== "1" || process.env.CONFIRM_DISPOSABLE_IMPORT_DATABASE !== "${disposableConfirmation}") process.exit(1);`,
    ], {
      env: childEnvironment,
      stage: "Integration guard environment",
    });
    const testResult = await runCaptured(process.execPath, [
      vitestCli,
      "run",
      integrationTest,
      `--config=${configFile}`,
      "--reporter=default",
    ], {
      env: childEnvironment,
      stage: "Import PostgreSQL integration suite",
      returnFailure: true,
    });
    if (!testResult.success) {
      throw new Error(`Import PostgreSQL integration suite failed (${testResult.errorClass}).`);
    }
    if (!/13 passed/.test(testResult.stdout) || /skipped|pending/i.test(testResult.stdout)) {
      throw new Error("Import PostgreSQL integration suite result count is unexpected.");
    }
    console.log("Guarded import PostgreSQL integration suite passed.");
  } finally {
    await stopOwnedChild(activeChild);
    await stopOwnedChild(ownedServer);
    activeChild = null;
    ownedServer = null;
    if (reportDirectory !== null) {
      await rm(reportDirectory, { recursive: true, force: true }).catch(() => {
        throw new Error("Disposable integration report cleanup failed.");
      });
      reportDirectory = null;
    }
  }
}

for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => {
    interruptedExitCode = exitCode;
    void stopOwnedChild(activeChild);
    void stopOwnedChild(ownedServer);
  });
}

try {
  await run();
  if (interruptedExitCode !== null) process.exitCode = interruptedExitCode;
} catch (error) {
  const candidate = error instanceof Error ? error.message : "";
  const message = /^(?:Disposable|Pinned|Transient|Runtime|Repository|Current|Complete|Import)/.test(candidate)
    ? candidate
    : "Disposable import integration bootstrap failed safely.";
  console.error(message);
  process.exitCode = interruptedExitCode ?? 1;
}
