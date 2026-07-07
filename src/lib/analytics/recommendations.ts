import type { Difficulty, SkillType } from "@prisma/client";
import { getPersonalizedRecommendations } from "@/lib/recommendations";

export type RecommendedProblem = {
  id: string;
  title: string;
  slug: string;
  skillType: SkillType;
  difficulty: Difficulty;
  reason: string;
  problemTopics: Array<{ topic: { name: string; slug: string } }>;
};

export async function getRecommendedProblemsForStudent(userId: string, take = 6): Promise<RecommendedProblem[]> {
  return getPersonalizedRecommendations(userId, take);
}
