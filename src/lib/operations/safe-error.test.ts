import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  classifySafePrismaErrorKind,
  safePrismaKnownRequestCode,
  type SafePrismaErrorKind,
} from "@/lib/operations/safe-error";

const SAFE_KINDS = new Set<SafePrismaErrorKind>([
  "known-request",
  "unknown-request",
  "initialization",
  "validation",
  "rust-panic",
  "not-prisma",
  "unknown",
]);

function knownRequest(code: string, meta: Record<string, unknown> | undefined = undefined) {
  return new Prisma.PrismaClientKnownRequestError("SENSITIVE_MESSAGE_SENTINEL", {
    code,
    clientVersion: "SENSITIVE_CLIENT_VERSION_SENTINEL",
    meta,
  });
}

function bundledKnownRequest(code: string, meta: Record<string, unknown> | undefined = undefined) {
  const error = Object.create(Error.prototype);
  Object.defineProperties(error, {
    name: { value: "PrismaClientKnownRequestError", configurable: true, writable: true },
    code: { value: code, configurable: true, writable: true, enumerable: true },
    meta: { value: meta, configurable: true, writable: true, enumerable: true },
    clientVersion: {
      value: "SENSITIVE_BUNDLED_CLIENT_VERSION_SENTINEL",
      configurable: true,
      writable: true,
      enumerable: true,
    },
    batchRequestIdx: { value: undefined, configurable: true, writable: true },
  });
  return error;
}

describe("safe Prisma error observability", () => {
  it.each(["P2002", "P2024", "P2028", "P2034"])("emits allowlisted known-request code %s", (code) => {
    const error = knownRequest(code);
    expect(safePrismaKnownRequestCode(error)).toBe(code);
    expect(classifySafePrismaErrorKind(error)).toBe("known-request");
  });

  it("keeps a typed but non-allowlisted code unknown", () => {
    const error = knownRequest("P2000");
    expect(safePrismaKnownRequestCode(error)).toBe("unknown");
    expect(classifySafePrismaErrorKind(error)).toBe("known-request");
  });

  it("recognizes an exact bundled-copy-shaped known-request error", () => {
    const error = bundledKnownRequest("P2024");
    expect(safePrismaKnownRequestCode(error)).toBe("P2024");
    expect(classifySafePrismaErrorKind(error)).toBe("known-request");
  });

  it.each([
    { name: "PrismaClientKnownRequestError", code: "P2024" },
    Object.assign(new Error("ambiguous"), { name: "PrismaClientKnownRequestError", code: "P2024" }),
    Object.assign(new Error("wrong identity"), {
      name: "PrismaClientKnownRequestError",
      code: "P2024",
      meta: undefined,
      clientVersion: "synthetic",
    }),
  ])("fails closed for forged or incomplete known-request identity", (error) => {
    expect(safePrismaKnownRequestCode(error)).toBe("unknown");
    expect(classifySafePrismaErrorKind(error)).toBe("unknown");
  });

  it("does not invoke getters or inspect sensitive metadata", () => {
    const accessed = vi.fn();
    const metadata = new Proxy({ nested: "SENSITIVE_META_SENTINEL" }, {
      get() {
        accessed();
        throw new Error("SENSITIVE_GETTER_SENTINEL");
      },
      ownKeys() {
        accessed();
        throw new Error("SENSITIVE_ENUMERATION_SENTINEL");
      },
    });
    const error = bundledKnownRequest("P2028", metadata);

    expect(safePrismaKnownRequestCode(error)).toBe("P2028");
    expect(classifySafePrismaErrorKind(error)).toBe("known-request");
    expect(accessed).not.toHaveBeenCalled();
  });

  it("fails closed when an identity property is an accessor", () => {
    const accessed = vi.fn();
    const error = bundledKnownRequest("P2024");
    Object.defineProperty(error, "name", {
      configurable: true,
      get() {
        accessed();
        throw new Error("SENSITIVE_NAME_GETTER_SENTINEL");
      },
    });

    expect(safePrismaKnownRequestCode(error)).toBe("unknown");
    expect(classifySafePrismaErrorKind(error)).toBe("unknown");
    expect(accessed).not.toHaveBeenCalled();
  });

  it("fails closed when proxy reflection throws", () => {
    const error = new Proxy(new Error("SENSITIVE_PROXY_SENTINEL"), {
      getPrototypeOf() {
        throw new Error("SENSITIVE_REFLECTION_SENTINEL");
      },
    });

    expect(safePrismaKnownRequestCode(error)).toBe("unknown");
    expect(classifySafePrismaErrorKind(error)).toBe("unknown");
  });

  it("classifies every supported error family with only fixed kind values", () => {
    const cases: Array<[unknown, SafePrismaErrorKind]> = [
      [knownRequest("P2002"), "known-request"],
      [new Prisma.PrismaClientUnknownRequestError("synthetic", { clientVersion: "synthetic" }), "unknown-request"],
      [new Prisma.PrismaClientInitializationError("synthetic", "synthetic"), "initialization"],
      [new Prisma.PrismaClientValidationError("synthetic", { clientVersion: "synthetic" }), "validation"],
      [new Prisma.PrismaClientRustPanicError("synthetic", "synthetic"), "rust-panic"],
      [new Error("synthetic"), "not-prisma"],
      [null, "not-prisma"],
    ];

    for (const [error, expected] of cases) {
      const actual = classifySafePrismaErrorKind(error);
      expect(actual).toBe(expected);
      expect(SAFE_KINDS.has(actual)).toBe(true);
    }
  });
});
