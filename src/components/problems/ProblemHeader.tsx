import { Clock3 } from "lucide-react";
import { DifficultyBadge, SkillBadge, SourceBadge, TopicTag } from "@/components/ui/Badges";
import type { ClientProblem } from "@/lib/problem-types";
import { questionTypeLabels } from "@/lib/labels";
import { formatPercent } from "@/lib/utils";

export function ProblemHeader({ problem }: { problem: ClientProblem }) {
  return (
    <header className="surface rounded-3xl p-6">
      <div className="flex flex-wrap items-center gap-2">
        <SkillBadge skill={problem.skillType} />
        <DifficultyBadge difficulty={problem.difficulty} />
        <span className="rounded-full bg-panel-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {questionTypeLabels[problem.questionType]}
        </span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{problem.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">{problem.statement}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        {problem.estimatedMinutes ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-4" aria-hidden="true" />
            {problem.estimatedMinutes} phút
          </span>
        ) : null}
        <span>Accuracy: {formatPercent(problem.acceptanceRate)}</span>
        <SourceBadge name={problem.sourceCollection?.name ?? "Manual"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {problem.problemTopics.map(({ topic }) => (
          <TopicTag key={topic.slug} name={topic.name} />
        ))}
      </div>
    </header>
  );
}
