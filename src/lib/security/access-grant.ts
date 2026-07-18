import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { ContestVisibility } from "@prisma/client";
import { getAuthSecret } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { verifyAccessCode } from "@/lib/security/access-code";
import { evaluateAccessGrant } from "@/lib/security/access-grant-decision";
import type { CleanupOperationResult } from "@/lib/security/cleanup-core";
import { decodeCanonicalBase64Url, signaturesMatch } from "@/lib/security/signature";

export { constantTimeEquals, verifyAccessCode } from "@/lib/security/access-code";

const CONTEST_ACCESS_GRANT_COOKIE = "englishphile_contest_grant";
const CONTEST_ACCESS_GRANT_TTL_SECONDS = 60 * 60;
const MAX_GRANT_TOKEN_LENGTH = 1024;

function generateGrantToken(grantId: string): string {
  const payload = Buffer.from(grantId).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(grantId)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyGrantToken(token: string): string | null {
  if (token.length > MAX_GRANT_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  try {
    const grantBytes = decodeCanonicalBase64Url(parts[0], MAX_GRANT_TOKEN_LENGTH);
    if (!grantBytes) return null;
    const grantId = grantBytes.toString("utf8");
    if (!grantId) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getAuthSecret())
      .update(grantId)
      .digest("base64url");
    if (!signaturesMatch(expectedSignature, parts[1])) {
      return null;
    }
    return grantId;
  } catch {
    return null;
  }
}

export async function getContestAccessGrantIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CONTEST_ACCESS_GRANT_COOKIE)?.value;
  return token ? verifyGrantToken(token) : null;
}

async function setGrantCookie(grantId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: CONTEST_ACCESS_GRANT_COOKIE,
    value: generateGrantToken(grantId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CONTEST_ACCESS_GRANT_TTL_SECONDS,
    path: "/",
  });
}

type LockedContest = {
  id: string;
  visibility: ContestVisibility;
  accessCode: string | null;
};

export type ContestAccessAuthorization =
  | { authorized: true; grantId: string }
  | { authorized: false };

/**
 * Verify the current code and create its grant while holding a row lock on the
 * contest. Every code/visibility mutation also deletes grants in its update
 * transaction, so either the mutation happens first (old code is rejected) or
 * it happens second (the newly created grant is deleted).
 */
export async function authorizeContestAccess(
  userId: string,
  contestId: string,
  providedCode: string,
): Promise<ContestAccessAuthorization> {
  const result = await prisma.$transaction(async (tx) => {
    const contests = await tx.$queryRaw<LockedContest[]>`
      SELECT "id", "visibility", "accessCode"
      FROM "Contest"
      WHERE "id" = ${contestId}
      FOR UPDATE
    `;
    const contest = contests[0];

    if (
      !contest ||
      contest.visibility !== "PRIVATE" ||
      !verifyAccessCode(providedCode, contest.accessCode)
    ) {
      return { authorized: false } as const;
    }

    await tx.contestAccessGrant.deleteMany({ where: { userId, contestId } });
    const createdAt = new Date();
    const grant = await tx.contestAccessGrant.create({
      data: {
        userId,
        contestId,
        createdAt,
        expiresAt: new Date(Date.now() + CONTEST_ACCESS_GRANT_TTL_SECONDS * 1000),
      },
    });
    return { authorized: true, grantId: grant.id } as const;
  });

  if (result.authorized) await setGrantCookie(result.grantId);
  return result;
}

export async function validateContestAccessGrant(
  userId: string,
  contestId: string,
): Promise<{ valid: boolean; reason?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CONTEST_ACCESS_GRANT_COOKIE)?.value;
  if (!token) return { valid: false, reason: "no-grant" };
  const grantId = verifyGrantToken(token);
  if (!grantId) return { valid: false, reason: "invalid-token" };

  const grant = await prisma.contestAccessGrant.findUnique({
    where: { id: grantId },
    include: {
      contest: { select: { id: true, accessCodeUpdatedAt: true } },
    },
  });

  return evaluateAccessGrant(grant, { userId, contestId, now: new Date() });
}

export async function revokeContestAccessGrants(contestId: string): Promise<number> {
  const result = await prisma.contestAccessGrant.deleteMany({ where: { contestId } });
  return result.count;
}

export async function revokeUserContestAccessGrant(
  userId: string,
  contestId: string,
): Promise<void> {
  await prisma.contestAccessGrant.deleteMany({ where: { userId, contestId } });
  const cookieStore = await cookies();
  cookieStore.delete(CONTEST_ACCESS_GRANT_COOKIE);
}

const ACCESS_GRANT_CLEANUP_BATCH = 500;

/** Bounded cleanup operation for the external scheduler. */
export async function cleanupExpiredAccessGrants(): Promise<CleanupOperationResult> {
  const cutoff = new Date();

  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "ContestAccessGrant"
      WHERE "id" IN (
        SELECT "id"
        FROM "ContestAccessGrant"
        WHERE "expiresAt" < ${cutoff}
        ORDER BY "expiresAt" ASC
        LIMIT ${ACCESS_GRANT_CLEANUP_BATCH}
      )
      AND "expiresAt" < ${cutoff}
    `;
    return { status: "success", affected: Number(deleted) };
  } catch {
    return { status: "infrastructure-error" };
  }
}
