import { Prisma } from "@prisma/client";

export type SafeErrorClass = "validation" | "database" | "filesystem" | "unknown";

const SAFE_PRISMA_KNOWN_REQUEST_CODES = new Set([
  "P2002",
  "P2003",
  "P2004",
  "P2011",
  "P2012",
  "P2014",
  "P2021",
  "P2022",
  "P2025",
  "P2034",
] as const);

export type SafePrismaKnownRequestCode =
  | "P2002"
  | "P2003"
  | "P2004"
  | "P2011"
  | "P2012"
  | "P2014"
  | "P2021"
  | "P2022"
  | "P2025"
  | "P2034";

export function safePrismaKnownRequestCode(error: unknown): SafePrismaKnownRequestCode | "unknown" {
  try {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return "unknown";
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    const code = descriptor && "value" in descriptor ? descriptor.value : undefined;
    return typeof code === "string" && SAFE_PRISMA_KNOWN_REQUEST_CODES.has(code as SafePrismaKnownRequestCode)
      ? code as SafePrismaKnownRequestCode
      : "unknown";
  } catch {
    return "unknown";
  }
}

export function classifySafeError(error: unknown): SafeErrorClass {
  try {
    if (error && typeof error === "object") {
      const descriptor = Object.getOwnPropertyDescriptor(error, "code");
      const code = descriptor && "value" in descriptor ? descriptor.value : undefined;
      if (typeof code === "string" && /^P\d{4}$/.test(code)) return "database";
      if (typeof code === "string" && /^E[A-Z0-9_]{1,31}$/.test(code)) return "filesystem";
      if (error instanceof SyntaxError || error instanceof TypeError) return "validation";
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function safeErrorSignal(action: string, error: unknown) {
  return {
    action: /^[a-z][a-z0-9-]{0,47}$/.test(action) ? action : "operation",
    errorClass: classifySafeError(error),
  } as const;
}
