import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const client = new PrismaClient({ log: [{ emit: "event", level: "error" }] });
  client.$on("error", () => {
    console.error("Database operation failed.", { action: "prisma", errorClass: "database" });
  });
  return client;
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
