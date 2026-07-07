import type { SkillType } from "@prisma/client";
import { getStudentSkillDetail, getStudentSkillStats } from "./student";

export async function getSkillAnalyticsForStudent(userId: string, skillType: SkillType) {
  return getStudentSkillDetail(userId, skillType);
}

export async function getAllSkillAnalyticsForStudent(userId: string) {
  return getStudentSkillStats(userId);
}
