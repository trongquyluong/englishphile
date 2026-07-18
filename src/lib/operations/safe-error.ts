export type SafeErrorClass = "validation" | "database" | "filesystem" | "unknown";

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
