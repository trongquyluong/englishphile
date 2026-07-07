import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentStatusBadge, DifficultyBadge, SkillBadge, SourceBadge, TopicTag } from "@/components/ui/Badges";
import { ProblemStatusIcon } from "@/components/problems/ProblemStatusIcon";
import type { ProblemListItem } from "@/lib/problem-types";
import { formatPercent } from "@/lib/utils";

export function ProblemTable({ problems }: { problems: ProblemListItem[] }) {
  return (
    <div className="surface overflow-hidden rounded-lg">
      <div className="hidden grid-cols-[48px_minmax(220px,1.4fr)_170px_1fr_96px_110px_92px] gap-3 border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft lg:grid">
        <span></span>
        <span>Tên bài</span>
        <span>Kỹ năng</span>
        <span>Topic</span>
        <span>Độ khó</span>
        <span>Độ đúng</span>
        <span></span>
      </div>
      <div className="divide-y divide-line">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className="grid gap-3 px-4 py-4 transition-[background-color] duration-150 hover:bg-panel-muted/60 lg:grid-cols-[48px_minmax(220px,1.4fr)_170px_1fr_96px_110px_92px] lg:items-center"
          >
            <div className="flex items-center gap-3 lg:block">
              <ProblemStatusIcon status={problem.status} />
              <Link href={`/problems/${problem.slug}`} className="font-semibold tracking-tight lg:hidden">
                {problem.title}
              </Link>
            </div>

            <div className="hidden lg:block">
              <Link href={`/problems/${problem.slug}`} className="font-semibold tracking-tight hover:text-accent-strong">
                {problem.title}
              </Link>
              {problem.contentStatus && problem.contentStatus !== "PUBLISHED" ? (
                <div className="mt-2">
                  <ContentStatusBadge status={problem.contentStatus} />
                </div>
              ) : null}
              <div className="mt-1 lg:hidden">
                <SourceBadge name={problem.sourceCollection?.name ?? "Manual"} />
              </div>
            </div>

            <div>
              <SkillBadge skill={problem.skillType} />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {problem.problemTopics.slice(0, 2).map(({ topic }) => (
                <TopicTag key={topic.slug} name={topic.name} />
              ))}
              {problem.problemTopics.length > 2 ? (
                <span className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                  +{problem.problemTopics.length - 2}
                </span>
              ) : null}
            </div>

            <div>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>

            <div className="tabular text-sm font-medium text-ink-soft">
              {formatPercent(problem.acceptanceRate)}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="hidden text-xs text-ink-soft lg:inline">
                <SourceBadge name={problem.sourceCollection?.name ?? "Manual"} />
              </span>
              <Link
                href={`/problems/${problem.slug}`}
                className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Làm
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
