import { notFound, redirect } from "next/navigation";
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

export function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
