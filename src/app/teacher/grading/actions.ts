"use server";

import { retiredClassroomNotFound } from "@/lib/features/retired-classroom";

export async function saveManualGradeAction(_formData: FormData) {
  void _formData;
  retiredClassroomNotFound();
}
