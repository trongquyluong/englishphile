import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { skillDescriptions, skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const recommendedDifficulty: Record<string, string> = {
  PRONUNCIATION: "B2 → C1",
  MULTIPLE_CHOICE: "C1",
  OPEN_CLOZE: "C1 → Chuyên",
  GUIDED_CLOZE: "C1",
  WORD_FORMATION: "C1 → Chuyên",
  SENTENCE_TRANSFORMATION: "Chuyên → HSG",
  ERROR_IDENTIFICATION: "C1 → Chuyên",
  READING: "C1 → Chuyên",
  WRITING: "Chuyên → HSG",
  TRIOS: "C1 → Chuyên",
  COLLOCATIONS: "B2 → C1",
  PHRASAL_VERBS: "C1",
  TRANSITIONS: "B2 → C1",
  GRAMMAR_FOCUS: "Chuyên",
};

export default async function SkillsPage() {
  const counts = await prisma.problem.groupBy({
    by: ["skillType"],
    where: { contentStatus: "PUBLISHED" },
    _count: { _all: true },
  });
  const countBySkill = new Map(counts.map((item) => [item.skillType, item._count._all]));

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Skill hub</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Luyện theo kỹ năng</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Mỗi skill là một cửa vào problem bank. Topic và độ khó sẽ được dùng để tinh chỉnh sau khi chọn skill.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skillOrder.map((skill) => (
          <article key={skill} className="surface surface-hover rounded-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{skillLabels[skill]}</h2>
              <span className="tabular rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold">
                {countBySkill.get(skill) ?? 0} bài
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{skillDescriptions[skill]}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Recommended: {recommendedDifficulty[skill]}
            </p>
            <Link
              href={`/problems?skill=${skill}`}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
            >
              Lọc kho bài
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
