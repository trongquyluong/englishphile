import { redirect } from "next/navigation";
import { requireManageClassroom } from "@/lib/classroom/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewClassAssignmentRedirectPage({ params }: PageProps) {
  const { id } = await params;
  await requireManageClassroom(id);
  redirect(`/teacher/assignments/new?classroomId=${encodeURIComponent(id)}`);
}
