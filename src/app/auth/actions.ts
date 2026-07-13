"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { clearSession, setSession } from "@/lib/auth/session";
import { hashPassword, verifyLoginPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export async function signUpAction(formData: FormData) {
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");
  const confirmPassword = getField(formData, "confirmPassword");
  const fullName = getField(formData, "fullName");
  const username = normalizeUsername(getField(formData, "username"));
  const school = getField(formData, "school");
  const province = getField(formData, "province");

  if (!email || !password || !fullName || !username) {
    redirectWithError("/auth/sign-up", "Vui lòng điền đủ thông tin.");
  }

  // Rate limit sign-up: 5 attempts per identifier per hour (database-backed for serverless)
  const signupLimit = await checkConfiguredRateLimit(RATE_LIMITS.SIGN_UP(email));
  if (signupLimit.status !== "allowed") {
    if (signupLimit.status === "infrastructure-error") {
      redirectWithError("/auth/sign-up", "Không thể xử lý yêu cầu. Vui lòng thử lại sau.");
    } else {
      redirectWithError(
        "/auth/sign-up",
        `Bạn thử quá nhiều lần. Hãy đợi ${signupLimit.retryAfterSeconds} giây rồi thử lại.`
      );
    }
  }

  if (username.length < 3) {
    redirectWithError("/auth/sign-up", "Tên người dùng cần ít nhất 3 ký tự và chỉ dùng chữ, số hoặc dấu gạch dưới.");
  }

  if (password.length < 8) {
    redirectWithError("/auth/sign-up", "Mật khẩu cần ít nhất 8 ký tự.");
  }

  if (password !== confirmPassword) {
    redirectWithError("/auth/sign-up", "Mật khẩu xác nhận không khớp.");
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });

  if (existing) {
    redirectWithError("/auth/sign-up", "Không thể tạo tài khoản với thông tin này.");
  }

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: fullName,
        fullName,
        role: "STUDENT",
        passwordHash: hashPassword(password),
        profile: {
          create: {
            school: school || null,
            province: province || null,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectWithError("/auth/sign-up", "Không thể tạo tài khoản với thông tin này.");
    }
    throw error;
  }

  await setSession(user.id);
  redirect("/dashboard");
}

export async function signInAction(formData: FormData) {
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");

  if (!email || !password) {
    redirectWithError("/auth/sign-in", "Vui lòng nhập email và mật khẩu.");
  }

  // Rate limit sign-in: 10 attempts per account per 15 minutes (database-backed for serverless)
  const signinLimit = await checkConfiguredRateLimit(RATE_LIMITS.SIGN_IN(email));
  if (signinLimit.status !== "allowed") {
    if (signinLimit.status === "infrastructure-error") {
      redirectWithError("/auth/sign-in", "Không thể xử lý yêu cầu. Vui lòng thử lại sau.");
    } else {
      redirectWithError(
        "/auth/sign-in",
        `Bạn đăng nhập quá nhiều lần. Hãy đợi ${signinLimit.retryAfterSeconds} giây rồi thử lại.`
      );
    }
  }

  // Always verify a password hash to prevent timing-based user enumeration.
  // The user lookup ALWAYS happens (DB access is similar timing for exists/not-exists).
  // If the user doesn't exist, we verify against a dummy hash so the same scrypt
  // computation runs for both cases — preventing timing attacks.
  const user = await prisma.user.findUnique({ where: { email } });

  if (!verifyLoginPassword(password, user?.passwordHash ?? null)) {
    // Use generic error message that doesn't reveal whether email exists
    redirectWithError("/auth/sign-in", "Email hoặc mật khẩu không đúng.");
  }

  // Type narrowing after the shared missing-user/wrong-password path.
  if (!user) {
    redirectWithError("/auth/sign-in", "Email hoặc mật khẩu không đúng.");
  }

  await setSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}

// CSRF protection: Next.js Server Actions include built-in origin/host validation.
// Route Handlers using cookie auth should use validateRequestOrigin() from @/lib/security/request-origin.
