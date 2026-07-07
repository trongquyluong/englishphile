"use server";

import type { AssignmentStatus, AssignmentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { generateJoinCode, requireTeacher } from "@/lib/classroom/permissions";
import { assignmentStatusOrder, assignmentTypeOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "1";
}

function dateOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function redirectWith(path: string, result: { ok: boolean; message: string }): never {
  const separator = path.includes("?") ? "&" : "?";
  const key = result.ok ? "message" : "error";
  redirect(`${path}${separator}${key}=${encodeURIComponent(result.message)}`);
}

async function uniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await prisma.classroom.findUnique({ where: { joinCode } });
    if (!existing) return joinCode;
  }
  return `${generateJoinCode()}${Date.now().toString(36).slice(-2)}`;
}

async function canManageClassroomId(classroomId: string | null, userId: string, role: string) {
  if (!classroomId) return true;
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) return false;
  return role === "ADMIN" || classroom.teacherId === userId;
}

function assignmentType(value: string): AssignmentType {
  return assignmentTypeOrder.includes(value as AssignmentType) ? (value as AssignmentType) : "PRACTICE_SET";
}

function assignmentStatus(value: string): AssignmentStatus {
  return assignmentStatusOrder.includes(value as AssignmentStatus) ? (value as AssignmentStatus) : "DRAFT";
}

function newAssignmentPath(classroomId: string | null) {
  return classroomId ? `/teacher/assignments/new?classroomId=${encodeURIComponent(classroomId)}` : "/teacher/assignments/new";
}

export async function createClassroomAction(formData: FormData) {
  const user = await requireTeacher();
  const name = text(formData, "name");
  if (!name) redirectWith("/teacher/classes", { ok: false, message: "Tên lớp không được để trống." });

  const classroom = await prisma.classroom.create({
    data: {
      name,
      description: nullableText(formData, "description"),
      teacherId: user.id,
      joinCode: await uniqueJoinCode(),
      members: { create: { userId: user.id, role: "TEACHER" } },
    },
  });

  revalidatePath("/teacher/classes");
  redirect(`/teacher/classes/${classroom.id}`);
}

export async function updateClassroomAction(formData: FormData) {
  const user = await requireTeacher();
  const classroomId = text(formData, "classroomId");
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom || (user.role !== "ADMIN" && classroom.teacherId !== user.id)) {
    redirectWith(`/teacher/classes/${classroomId}`, { ok: false, message: "Bạn không có quyền truy cập lớp này." });
  }

  const name = text(formData, "name");
  if (!name) {
    redirectWith(`/teacher/classes/${classroomId}?tab=settings`, { ok: false, message: "Tên lớp không được để trống." });
  }

  await prisma.classroom.update({
    where: { id: classroomId },
    data: { name, description: nullableText(formData, "description") },
  });
  revalidatePath(`/teacher/classes/${classroomId}`);
  redirectWith(`/teacher/classes/${classroomId}?tab=settings`, { ok: true, message: "Đã lưu cài đặt lớp." });
}

export async function regenerateJoinCodeAction(formData: FormData) {
  const user = await requireTeacher();
  const classroomId = text(formData, "classroomId");
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom || (user.role !== "ADMIN" && classroom.teacherId !== user.id)) {
    redirectWith(`/teacher/classes/${classroomId}`, { ok: false, message: "Bạn không có quyền truy cập lớp này." });
  }

  await prisma.classroom.update({ where: { id: classroomId }, data: { joinCode: await uniqueJoinCode() } });
  revalidatePath(`/teacher/classes/${classroomId}`);
  redirectWith(`/teacher/classes/${classroomId}?tab=settings`, { ok: true, message: "Đã tạo mã tham gia mới." });
}

export async function joinClassroomAction(formData: FormData) {
  const user = await requireUser();
  const joinCode = text(formData, "joinCode").toUpperCase();
  if (!joinCode) redirectWith("/classes/join", { ok: false, message: "Mã tham gia không hợp lệ." });
  if (user.role !== "STUDENT") {
    redirectWith("/classes/join", { ok: false, message: "Tài khoản giáo viên không thể tham gia lớp như học sinh." });
  }

  const classroom = await prisma.classroom.findUnique({ where: { joinCode } });
  if (!classroom) redirectWith("/classes/join", { ok: false, message: "Mã tham gia không hợp lệ." });

  const existing = await prisma.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId: user.id } },
  });
  if (existing) redirectWith("/classes/join", { ok: false, message: "Bạn đã tham gia lớp này." });

  await prisma.classroomMember.create({
    data: { classroomId: classroom.id, userId: user.id, role: "STUDENT" },
  });
  revalidatePath("/classes");
  redirect(`/classes/${classroom.id}`);
}

export async function createAssignmentAction(formData: FormData) {
  const user = await requireTeacher();
  const title = text(formData, "title");
  const classroomId = nullableText(formData, "classroomId");
  const selectedProblemIds = formData.getAll("problemId").map((value) => String(value)).filter(Boolean);
  const status = assignmentStatus(text(formData, "status"));
  const path = newAssignmentPath(classroomId);

  if (!title) redirectWith(path, { ok: false, message: "Tiêu đề bài giao không được để trống." });
  if (!(await canManageClassroomId(classroomId, user.id, user.role))) {
    redirectWith(path, { ok: false, message: "Bạn không có quyền truy cập lớp này." });
  }
  if (selectedProblemIds.length === 0) {
    redirectWith(path, { ok: false, message: "Bài giao cần có ít nhất một problem." });
  }

  const problems = await prisma.problem.findMany({
    where: { id: { in: selectedProblemIds }, contentStatus: "PUBLISHED" },
    select: { id: true },
  });
  const publishedIds = new Set(problems.map((problem) => problem.id));
  if (selectedProblemIds.some((id) => !publishedIds.has(id))) {
    redirectWith(path, { ok: false, message: "Chỉ có thể giao problem đã xuất bản." });
  }

  const assignment = await prisma.assignment.create({
    data: {
      title,
      description: nullableText(formData, "description"),
      classroomId,
      createdById: user.id,
      assignmentType: assignmentType(text(formData, "assignmentType")),
      status,
      dueAt: dateOrNull(formData, "dueAt"),
      timeLimitMinutes: numberOrNull(formData, "timeLimitMinutes"),
      allowLateSubmission: bool(formData, "allowLateSubmission"),
      showAnswersAfterSubmit: bool(formData, "showAnswersAfterSubmit"),
      problems: {
        create: selectedProblemIds.map((problemId, index) => ({
          problemId,
          orderIndex: index,
          points: 1,
        })),
      },
    },
  });

  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/assignments/new");
  redirect(`/teacher/assignments/${assignment.id}`);
}

export async function assignmentStatusAction(formData: FormData) {
  const user = await requireTeacher();
  const assignmentId = text(formData, "assignmentId");
  const intent = text(formData, "intent");
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { classroom: true, problems: { include: { problem: true } } },
  });
  if (!assignment || (user.role !== "ADMIN" && assignment.createdById !== user.id && assignment.classroom?.teacherId !== user.id)) {
    redirectWith(`/teacher/assignments/${assignmentId}`, { ok: false, message: "Bạn không có quyền thực hiện thao tác này." });
  }

  if (intent === "duplicate") {
    const copy = await prisma.assignment.create({
      data: {
        title: `${assignment.title} (copy)`,
        description: assignment.description,
        classroomId: assignment.classroomId,
        createdById: user.id,
        assignmentType: assignment.assignmentType,
        status: "DRAFT",
        dueAt: assignment.dueAt,
        timeLimitMinutes: assignment.timeLimitMinutes,
        allowLateSubmission: assignment.allowLateSubmission,
        showAnswersAfterSubmit: assignment.showAnswersAfterSubmit,
        problems: {
          create: assignment.problems.map((item) => ({
            problemId: item.problemId,
            orderIndex: item.orderIndex,
            points: item.points,
          })),
        },
      },
    });
    redirect(`/teacher/assignments/${copy.id}`);
  }

  if (intent === "publish") {
    if (assignment.problems.length === 0) {
      redirectWith(`/teacher/assignments/${assignmentId}`, { ok: false, message: "Bài giao cần có ít nhất một problem." });
    }
    if (assignment.problems.some((item) => item.problem.contentStatus !== "PUBLISHED")) {
      redirectWith(`/teacher/assignments/${assignmentId}`, { ok: false, message: "Chỉ có thể giao problem đã xuất bản." });
    }
  }

  const nextStatus: AssignmentStatus =
    intent === "publish" ? "PUBLISHED" : intent === "close" ? "CLOSED" : intent === "archive" ? "ARCHIVED" : "DRAFT";
  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: nextStatus } });
  revalidatePath(`/teacher/assignments/${assignmentId}`);
  revalidatePath("/teacher/classes");
  redirectWith(`/teacher/assignments/${assignmentId}`, { ok: true, message: "Đã cập nhật bài giao." });
}
