"use server";

import { redirect } from "next/navigation";
import { clearSession, setSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

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

  const signupLimit = checkRateLimit({ key: `sign-up:${email || username}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!signupLimit.ok) {
    redirectWithError("/auth/sign-up", `Bạn thử quá nhiều lần. Hãy đợi ${signupLimit.retryAfterSeconds} giây rồi thử lại.`);
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
    redirectWithError("/auth/sign-up", existing.email === email ? "Email này đã có tài khoản." : "Tên người dùng này đã được dùng.");
  }

  const user = await prisma.user.create({
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

  await setSession(user.id);
  redirect("/dashboard");
}

export async function signInAction(formData: FormData) {
  const email = getField(formData, "email").toLowerCase();
  const password = getField(formData, "password");

  if (!email || !password) {
    redirectWithError("/auth/sign-in", "Vui lòng nhập email và mật khẩu.");
  }

  const signinLimit = checkRateLimit({ key: `sign-in:${email}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!signinLimit.ok) {
    redirectWithError("/auth/sign-in", `Bạn đăng nhập quá nhiều lần. Hãy đợi ${signinLimit.retryAfterSeconds} giây rồi thử lại.`);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirectWithError("/auth/sign-in", "Email hoặc mật khẩu không đúng.");
  }

  await setSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}

// TODO(auth): Replace the local signed-cookie scaffold with rotating sessions,
// CSRF protection for mutating forms, rate limiting, and password reset flows.
