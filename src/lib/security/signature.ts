import { timingSafeEqual } from "node:crypto";

const MAX_SIGNATURE_CHARACTERS = 128;

export function decodeCanonicalBase64Url(value: string, maxCharacters: number): Buffer | null {
  if (value.length === 0 || value.length > maxCharacters || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length > 0 && decoded.toString("base64url") === value ? decoded : null;
  } catch {
    return null;
  }
}

/** Decode canonically, prepare equal-sized buffers, then compare in constant time. */
export function signaturesMatch(expected: string, supplied: string): boolean {
  const expectedBytes = decodeCanonicalBase64Url(expected, MAX_SIGNATURE_CHARACTERS);
  const suppliedBytes = decodeCanonicalBase64Url(supplied, MAX_SIGNATURE_CHARACTERS);
  if (!expectedBytes || !suppliedBytes) return false;
  const preparedLength = Math.max(expectedBytes.length, suppliedBytes.length);
  const preparedExpected = Buffer.alloc(preparedLength);
  const preparedSupplied = Buffer.alloc(preparedLength);
  expectedBytes.copy(preparedExpected);
  suppliedBytes.copy(preparedSupplied);
  return timingSafeEqual(preparedExpected, preparedSupplied) && expectedBytes.length === suppliedBytes.length;
}
