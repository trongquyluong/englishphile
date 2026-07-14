-- Phase 1C-A least-privilege role policy:
-- legacy TEACHER accounts become ordinary STUDENT accounts before the obsolete
-- enum value is removed. Classroom and assignment tables and rows are retained.
-- Keep the enum replacement atomic: a failure must not leave Role renamed or
-- User.role without its default. The ALTER statements take a short table lock,
-- so role-management writes must be paused for the deployment window.
BEGIN;

UPDATE "User"
SET "role" = 'STUDENT'
WHERE "role" = 'TEACHER';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "Role" RENAME TO "Role_legacy";
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "Role"
USING ("role"::text::"Role");

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT'::"Role";

DROP TYPE "Role_legacy";

COMMIT;
