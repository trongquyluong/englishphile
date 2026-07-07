import crypto from "crypto";

const KEY_LENGTH = 64;

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
