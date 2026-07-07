"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

function redirectWithMessage(ok: boolean, message: string): never {
  redirect(`/profile?${ok ? "message" : "error"}=${encodeURIComponent(message)}`);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const username = normalizeUsername(text(formData, "username"));
  const fullName = text(formData, "fullName");
  const school = text(formData, "school");
  const province = text(formData, "province");
  const targetExam = text(formData, "targetExam");
  const bio = text(formData, "bio");

  if (!username || username.length < 3) {
    redirectWithMessage(false, "Tên người dùng cần ít nhất 3 ký tự.");
  }

  if (!fullName) {
    redirectWithMessage(false, "Họ và tên không được để trống.");
  }

  const existingUsername = await prisma.user.findFirst({
    where: { username, NOT: { id: user.id } },
    select: { id: true },
  });
  if (existingUsername) {
    redirectWithMessage(false, "Tên người dùng này đã được dùng.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      fullName,
      displayName: fullName,
      profile: {
        upsert: {
          create: {
            school: school || null,
            province: province || null,
            targetExam: targetExam || null,
            bio: bio || null,
          },
          update: {
            school: school || null,
            province: province || null,
            targetExam: targetExam || null,
            bio: bio || null,
          },
        },
      },
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirectWithMessage(true, "Đã cập nhật hồ sơ.");
}
