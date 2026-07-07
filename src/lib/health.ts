import "server-only";

import { prisma } from "@/lib/prisma";

export type HealthStatus = {
  ok: boolean;
  app: "Englishphile";
  database: "connected" | "disconnected";
  timestamp: string;
  version: string | null;
};

export async function checkHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      app: "Englishphile",
      database: "connected",
      timestamp,
      version: process.env.npm_package_version ?? null,
    };
  } catch {
    return {
      ok: false,
      app: "Englishphile",
      database: "disconnected",
      timestamp,
      version: process.env.npm_package_version ?? null,
    };
  }
}
