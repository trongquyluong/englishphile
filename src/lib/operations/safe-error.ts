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
  "P2024",
  "P2025",
  "P2028",
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
  | "P2024"
  | "P2025"
  | "P2028"
  | "P2034";

export type SafePrismaErrorKind =
  | "known-request"
  | "unknown-request"
  | "initialization"
  | "validation"
  | "rust-panic"
  | "not-prisma"
  | "unknown";

type PrismaErrorInspection = {
  kind: SafePrismaErrorKind;
  code: SafePrismaKnownRequestCode | "unknown";
};

type PrismaErrorIdentity = {
  name: "PrismaClientKnownRequestError"
    | "PrismaClientUnknownRequestError"
    | "PrismaClientInitializationError"
    | "PrismaClientValidationError"
    | "PrismaClientRustPanicError";
  kind: Exclude<SafePrismaErrorKind, "not-prisma" | "unknown">;
  requiredOwnDataProperties: readonly PropertyKey[];
};

const PRISMA_ERROR_IDENTITIES: readonly PrismaErrorIdentity[] = [
  {
    name: "PrismaClientKnownRequestError",
    kind: "known-request",
    requiredOwnDataProperties: ["code", "meta", "clientVersion", "batchRequestIdx"],
  },
  {
    name: "PrismaClientUnknownRequestError",
    kind: "unknown-request",
    requiredOwnDataProperties: ["clientVersion", "batchRequestIdx"],
  },
  {
    name: "PrismaClientInitializationError",
    kind: "initialization",
    requiredOwnDataProperties: ["clientVersion", "errorCode"],
  },
  {
    name: "PrismaClientValidationError",
    kind: "validation",
    requiredOwnDataProperties: ["clientVersion"],
  },
  {
    name: "PrismaClientRustPanicError",
    kind: "rust-panic",
    requiredOwnDataProperties: ["clientVersion"],
  },
] as const;

function ownDataDescriptor(value: object, key: PropertyKey): PropertyDescriptor | null {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor : null;
}

function importedPrismaErrorKind(error: object): SafePrismaErrorKind | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return "known-request";
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return "unknown-request";
  if (error instanceof Prisma.PrismaClientInitializationError) return "initialization";
  if (error instanceof Prisma.PrismaClientValidationError) return "validation";
  if (error instanceof Prisma.PrismaClientRustPanicError) return "rust-panic";
  return null;
}

function bundledPrismaErrorKind(error: object): SafePrismaErrorKind {
  const rawNameDescriptor = Object.getOwnPropertyDescriptor(error, "name");
  if (!rawNameDescriptor) return "not-prisma";
  if (!("value" in rawNameDescriptor) || typeof rawNameDescriptor.value !== "string") return "unknown";
  const nameDescriptor = rawNameDescriptor;
  const identity = PRISMA_ERROR_IDENTITIES.find((candidate) => candidate.name === nameDescriptor.value);
  if (!identity) return "not-prisma";
  if (!(error instanceof Error)) return "unknown";
  for (const key of identity.requiredOwnDataProperties) {
    if (!ownDataDescriptor(error, key)) return "unknown";
  }
  return identity.kind;
}

function inspectPrismaError(error: unknown): PrismaErrorInspection {
  try {
    if (!error || typeof error !== "object") return { kind: "not-prisma", code: "unknown" };
    const kind = importedPrismaErrorKind(error) ?? bundledPrismaErrorKind(error);
    if (kind !== "known-request") return { kind, code: "unknown" };
    const codeDescriptor = ownDataDescriptor(error, "code");
    const code = codeDescriptor?.value;
    return {
      kind,
      code: typeof code === "string" && SAFE_PRISMA_KNOWN_REQUEST_CODES.has(code as SafePrismaKnownRequestCode)
        ? code as SafePrismaKnownRequestCode
        : "unknown",
    };
  } catch {
    return { kind: "unknown", code: "unknown" };
  }
}

export function safePrismaKnownRequestCode(error: unknown): SafePrismaKnownRequestCode | "unknown" {
  return inspectPrismaError(error).code;
}

export function classifySafePrismaErrorKind(error: unknown): SafePrismaErrorKind {
  return inspectPrismaError(error).kind;
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
