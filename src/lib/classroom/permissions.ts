import "server-only";

import { notFound, redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import type { Assignment, Classroom, User } from "@prisma/client";
import { isAdminUser, requireAdmin, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

export async function requireAdminOrTeacher() {
  return requireAdmin();
}

export async function requireTeacher() {
  return requireAdmin();
}

export function canManageClassroom(user: Pick<User, "id" | "email" | "role">, classroom: Pick<Classroom, "teacherId">) {
  return isAdminUser(user) || classroom.teacherId === user.id;
}

export async function requireManageClassroom(classroomId: string) {
  const user = await requireTeacher();
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) notFound();
  if (!canManageClassroom(user, classroom)) redirect("/dashboard");
  return { user, classroom };
}

export async function canViewAssignment(user: Pick<User, "id" | "email" | "role">, assignment: Pick<Assignment, "id" | "classroomId" | "createdById">) {
  if (isAdminUser(user) || assignment.createdById === user.id || !assignment.classroomId) return true;
  const member = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: assignment.classroomId, userId: user.id } },
  });
  return Boolean(member);
}

export async function canSubmitAssignment(user: Pick<User, "id" | "role">, assignment: Pick<Assignment, "id" | "classroomId" | "status">) {
  if (user.role !== "STUDENT") return false;
  if (assignment.status !== "PUBLISHED") return false;
  if (!assignment.classroomId) return true;
  const member = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: assignment.classroomId, userId: user.id } },
  });
  return member?.role === "STUDENT";
}

export async function requireStudentClassroom(classroomId: string) {
  const user = await requireUser();
  const member = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
    include: { classroom: { include: { teacher: true } } },
  });
  if (!member && !isAdminUser(user)) notFound();
  return { user, member };
}

export function canManageAssignment(user: CurrentUser, assignment: Pick<Assignment, "createdById" | "classroomId"> & { classroom?: Pick<Classroom, "teacherId"> | null }) {
  return isAdminUser(user) || assignment.createdById === user.id || assignment.classroom?.teacherId === user.id;
}

const JOIN_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const JOIN_CODE_LENGTH = 6;

/**
 * Generate a cryptographically secure classroom join code.
 * Uses crypto.randomInt for uniform distribution without modulo bias.
 * Alphabet: 36 chars (A-Z, 0-9), 6 chars = ~31 bits entropy.
 */
export function generateJoinCode(): string {
  const code: string[] = [];
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    // randomInt is uniform in [0, max) with no modulo bias
    const randomIndex = randomInt(0, JOIN_CODE_ALPHABET.length);
    code.push(JOIN_CODE_ALPHABET[randomIndex]!);
  }
  return code.join("");
}
