import Link from "next/link";
import type { SkillType } from "@prisma/client";
import { ArrowRight, Dumbbell } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { skillDescriptions, skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const useOfEnglishSkills: SkillType[] = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
];

export default async function GymUseOfEnglishPage() {
  const user = await getCurrentUser();
  const [counts, profiles] = await Promise.all([
    prisma.problem.groupBy({
      by: ["skillType"],
      where: { contentStatus: "PUBLISHED", skillType: { in: useOfEnglishSkills } },
      _count: { _all: true },
    }),
    user ? prisma.userSkillProfile.findMany({ where: { userId: user.id, skillType: { in: useOfEnglishSkills } } }) : Promise.resolve([]),
  ]);
  const countBySkill = new Map(counts.map((item) => [item.skillType, item._count._all]));
  const profileBySkill = new Map(profiles.map((item) => [item.skillType, item]));

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Dumbbell className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Gym / Use of English</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Ngữ pháp và từ vựng dưới áp lực đề thi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Chọn một dạng bài cụ thể. Englishphile giữ các topic ở bộ lọc và metadata, không biến trang luyện tập thành một đống chip.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {useOfEnglishSkills.map((skill) => (
          <article key={skill} className="surface surface-hover rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{skillLabels[skill]}</h2>
              <span className="tabular-nums rounded-lg bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">{countBySkill.get(skill) ?? 0} bài</span>
            </div>
            {user ? (
              <p className="mt-2 text-xs font-semibold text-accent-strong">
                {profileBySkill.get(skill)?.attempted ? `${Math.round((profileBySkill.get(skill)?.accuracy ?? 0) * 100)}% · ${profileBySkill.get(skill)?.attempted} câu` : "Chưa đủ dữ liệu"}
              </p>
            ) : null}
            <p className="mt-3 min-h-16 text-sm leading-6 text-ink-soft text-pretty">{skillDescriptions[skill]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/problems?mode=use-of-english&skill=${skill}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
                Luyện dạng này
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href={`/analytics/skills/${skill}`} className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-3 text-sm font-semibold">
                Tiến độ
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
