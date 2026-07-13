import { timingSafeEqual } from "node:crypto";

export const MAX_ACCESS_CODE_BYTES = 128;

export function constantTimeEquals(a: string, b: string): boolean {
  if (
    Buffer.byteLength(a, "utf8") > MAX_ACCESS_CODE_BYTES ||
    Buffer.byteLength(b, "utf8") > MAX_ACCESS_CODE_BYTES
  ) {
    return false;
  }

  const normalizedA = a.trim().toUpperCase();
  const normalizedB = b.trim().toUpperCase();
  const bytesA = Buffer.from(normalizedA, "utf8");
  const bytesB = Buffer.from(normalizedB, "utf8");

  if (bytesA.length > MAX_ACCESS_CODE_BYTES || bytesB.length > MAX_ACCESS_CODE_BYTES) {
    return false;
  }

  const paddedA = Buffer.alloc(MAX_ACCESS_CODE_BYTES);
  const paddedB = Buffer.alloc(MAX_ACCESS_CODE_BYTES);
  bytesA.copy(paddedA);
  bytesB.copy(paddedB);

  const valuesEqual = timingSafeEqual(paddedA, paddedB);
  const lengthsEqual = bytesA.length === bytesB.length;
  return lengthsEqual && valuesEqual;
}

export function verifyAccessCode(providedCode: string, storedCode: string | null): boolean {
  return storedCode !== null && storedCode.length > 0 && constantTimeEquals(providedCode, storedCode);
}
