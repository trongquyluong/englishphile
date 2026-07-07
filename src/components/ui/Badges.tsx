import type { AssignmentStatus, AssignmentSubmissionStatus, AssignmentType, ContentPackStatus, ContentStatus, Difficulty, SkillType } from "@prisma/client";
import {
  assignmentStatusLabels,
  assignmentSubmissionStatusLabels,
  assignmentTypeLabels,
  contentPackStatusLabels,
  contentStatusLabels,
  difficultyLabels,
  skillLabels,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export function SkillBadge({ skill }: { skill: SkillType }) {
  return (
    <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">
      {skillLabels[skill]}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const tone =
    difficulty === "HSG" || difficulty === "CHUYEN"
      ? "bg-amber-100 text-amber-900"
      : difficulty === "C2"
        ? "bg-red-50 text-red-800"
        : "bg-panel-muted text-foreground";

  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tone)}>
      {difficultyLabels[difficulty]}
    </span>
  );
}

export function TopicTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded bg-white px-2 py-1 text-xs font-medium text-ink-soft shadow-[0_0_0_1px_rgba(23,33,27,0.1)]">
      {name}
    </span>
  );
}

export function SourceBadge({ name }: { name: string }) {
  return <span className="text-xs font-medium text-ink-soft">{name}</span>;
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-accent-soft text-accent-strong"
      : status === "NEEDS_REVIEW"
        ? "bg-amber-100 text-amber-900"
        : status === "ARCHIVED"
          ? "bg-slate-100 text-slate-700"
          : "bg-panel-muted text-foreground";

  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tone)}>
      {contentStatusLabels[status]}
    </span>
  );
}

export function ContentPackStatusBadge({ status }: { status: ContentPackStatus }) {
  const tone =
    status === "IMPORTED" || status === "VALIDATED"
      ? "bg-accent-soft text-accent-strong"
      : status === "FAILED"
        ? "bg-red-50 text-danger"
        : status === "PARTIALLY_IMPORTED"
          ? "bg-amber-100 text-amber-900"
          : status === "ARCHIVED"
            ? "bg-slate-100 text-slate-700"
            : "bg-panel-muted text-foreground";

  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tone)}>{contentPackStatusLabels[status]}</span>;
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-accent-soft text-accent-strong"
      : status === "CLOSED"
        ? "bg-amber-100 text-amber-900"
        : status === "ARCHIVED"
          ? "bg-slate-100 text-slate-700"
          : "bg-panel-muted text-foreground";

  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tone)}>{assignmentStatusLabels[status]}</span>;
}

export function AssignmentTypeBadge({ type }: { type: AssignmentType }) {
  return <span className="inline-flex items-center rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-foreground">{assignmentTypeLabels[type]}</span>;
}

export function AssignmentSubmissionStatusBadge({ status }: { status: AssignmentSubmissionStatus }) {
  const tone =
    status === "SUBMITTED"
      ? "bg-accent-soft text-accent-strong"
      : status === "LATE" || status === "NEEDS_REVIEW"
        ? "bg-amber-100 text-amber-900"
        : "bg-panel-muted text-foreground";

  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tone)}>{assignmentSubmissionStatusLabels[status]}</span>;
}
