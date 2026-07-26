import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  isConfiguredOwnerEmail,
  isContentAdminIdentity,
} from "@/lib/auth/content-admin-policy";
import { getAuthSecret } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { decodeCanonicalBase64Url, signaturesMatch } from "@/lib/security/signature";

const SESSION_COOKIE = "englishphile_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

function getSecret() {
  return getAuthSecret();
}

export function isOwnerEmail(email: string | null | undefined) {
  return isConfiguredOwnerEmail(email, process.env.OWNER_EMAIL);
}

export function isContentAdminUser(user: Pick<CurrentUser, "email" | "role"> | null | undefined) {
  return isContentAdminIdentity(user, process.env.OWNER_EMAIL);
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function decodeSession(value: string | undefined): SessionPayload | null {
  if (!value || value.length > 4096) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const bodyBytes = body ? decodeCanonicalBase64Url(body, 2048) : null;

  if (!body || !bodyBytes || !signature || !signaturesMatch(sign(body), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(bodyBytes.toString("utf8")) as SessionPayload;
    if (!payload.userId || payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: encodeSession({
      userId,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}

export async function getCurrentUserOrRedirect() {
  return requireUser();
}

export async function requireContentAdmin() {
  const user = await requireUser();

  if (!isContentAdminUser(user)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Compatibility name for existing Server Actions. Its policy is content-admin
 * authorization: stored ADMIN or a current database user matching OWNER_EMAIL.
 */
export const requireAdmin = requireContentAdmin;

export async function requireRole(roles: Role[]) {
  const user = await requireUser();

  if (roles.includes(user.role) || (roles.includes("ADMIN") && isContentAdminUser(user))) {
    return user;
  }

  redirect("/unauthorized");
}
