import type { Prisma } from "@prisma/client";
import { isContentAdminIdentity } from "@/lib/auth/content-admin-policy";

export const CONTENT_ADMIN_TRANSACTION_DENIED = "Không có quyền truy cập.";

export class ContentAdminTransactionAuthorizationError extends Error {
  constructor() {
    super(CONTENT_ADMIN_TRANSACTION_DENIED);
    this.name = "ContentAdminTransactionAuthorizationError";
  }
}

export function isContentAdminTransactionAuthorizationError(
  error: unknown,
): error is ContentAdminTransactionAuthorizationError {
  return error instanceof ContentAdminTransactionAuthorizationError;
}

/**
 * Revalidates and stabilizes the request principal inside an admin mutation.
 *
 * Lock order for Phase 1C-B mutations is always current User first, followed
 * by the parent resource and then ordered child rows. FOR UPDATE prevents a
 * concurrent role/email update or user deletion from revoking the decision
 * before this transaction commits.
 */
export async function requireContentAdminInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string; email: string; role: "STUDENT" | "ADMIN" }>>`
    SELECT "id", "email", "role"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;
  const user = rows[0];
  if (!user || !isContentAdminIdentity(user, process.env.OWNER_EMAIL)) {
    throw new ContentAdminTransactionAuthorizationError();
  }
  return { id: user.id };
}
