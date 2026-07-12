import crypto from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Pre-computed dummy password hash for constant-time login handling.
 * When a user does not exist, we verify against this hash to ensure
 * the same scrypt computation runs as for a real user, preventing
 * timing-based user enumeration.
 *
 * This is a real, fixed scrypt result generated once from a non-secret dummy
 * password and a 32-character salt shaped like production salts. It is never
 * generated during a request.
 */
const DUMMY_PASSWORD_HASH =
  "scrypt$000102030405060708090a0b0c0d0e0f$5bae787afdd700edaada5a938d8174e5a6548a87c8b76276e48621bca8a1dfad653a1e6e6d3a4aea2adc8fa8637d22c3b3dace7e20a741f257729de449d441c0";

/**
 * Dummy scrypt hash used for non-existent users to prevent timing attacks.
 * All real password hashes are scrypt; this ensures equal computation time.
 */
export const DUMMY_PASSWORD_HASH_VALUE = DUMMY_PASSWORD_HASH;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, storedHash] = passwordHash.split("$");

  if (scheme !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const stored = Buffer.from(storedHash, "hex");

  if (stored.length !== hash.length) {
    return false;
  }

  return crypto.timingSafeEqual(stored, hash);
}

type PasswordVerifier = (password: string, passwordHash: string) => boolean;

export function createLoginPasswordVerifier(verify: PasswordVerifier = verifyPassword) {
  return (password: string, userPasswordHash: string | null): boolean => {
    const matched = verify(password, userPasswordHash ?? DUMMY_PASSWORD_HASH_VALUE);
    return userPasswordHash !== null && matched;
  };
}

export const verifyLoginPassword = createLoginPasswordVerifier();
