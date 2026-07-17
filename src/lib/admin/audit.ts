import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function json(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function createContentAuditLog(input: {
  userId: string;
  entityType: string;
  entityId: string;
  action: "CREATED" | "UPDATED" | "PUBLISHED" | "ARCHIVED" | "REVIEWED" | "RESTORED";
  beforeJson?: unknown;
  afterJson?: unknown;
}, db: Prisma.TransactionClient | typeof prisma = prisma) {
  return db.contentAuditLog.create({
    data: {
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: json(input.beforeJson),
      afterJson: json(input.afterJson),
    },
  });
}
