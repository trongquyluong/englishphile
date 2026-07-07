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

/** Consistent learner-facing badge size: text-xs + font-semibold + rounded-md + px-2 py-1 */
const badgeBase = "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold";

export function SkillBadge({ skill, className }: { skill: SkillType; className?: string }) {
  return (
    <span role="status" className={cn(badgeBase, "bg-accent-soft text-accent-strong", className)}>
      {skillLabels[skill]}
    </span>
  );
}

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  const tone =
    difficulty === "HSG" || difficulty === "CHUYEN"
      ? "bg-warning-soft text-warning"
      : difficulty === "C2"
        ? "bg-danger-soft text-danger"
        : "bg-panel-muted text-foreground";

  return (
    <span role="status" className={cn(badgeBase, tone, className)}>
      {difficultyLabels[difficulty]}
    </span>
  );
}

export function TopicTag({ name, className }: { name: string; className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-md bg-panel px-2 py-1 text-xs font-medium text-ink-soft shadow-[inset_0_0_0_1px_var(--line)]",
        className,
      )}
    >
      {name}
    </span>
  );
}

export function SourceBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span role="status" className={cn("text-xs font-medium text-ink-soft", className)}>
      {name}
    </span>
  );
}

/** Question number badge: "Câu 12" */
export function QuestionNumberBadge({ number, className }: { number: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label={`Câu ${number}`}
      className={cn(
        "inline-flex items-center rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background",
        className,
      )}
    >
      Câu {number}
    </span>
  );
}

export function ContentStatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-accent-soft text-accent-strong"
      : status === "NEEDS_REVIEW"
        ? "bg-warning-soft text-warning"
        : status === "ARCHIVED"
          ? "bg-panel-muted text-ink-soft"
          : "bg-panel-muted text-foreground";

  return (
    <span role="status" className={cn(badgeBase, tone, className)}>
      {contentStatusLabels[status]}
    </span>
  );
}

export function ContentPackStatusBadge({ status, className }: { status: ContentPackStatus; className?: string }) {
  const tone =
    status === "IMPORTED" || status === "VALIDATED"
      ? "bg-accent-soft text-accent-strong"
      : status === "FAILED"
        ? "bg-danger-soft text-danger"
        : status === "PARTIALLY_IMPORTED"
          ? "bg-warning-soft text-warning"
          : status === "ARCHIVED"
            ? "bg-panel-muted text-ink-soft"
            : "bg-panel-muted text-foreground";

  return (
    <span role="status" className={cn(badgeBase, tone, className)}>
      {contentPackStatusLabels[status]}
    </span>
  );
}

export function AssignmentStatusBadge({ status, className }: { status: AssignmentStatus; className?: string }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-accent-soft text-accent-strong"
      : status === "CLOSED"
        ? "bg-warning-soft text-warning"
        : status === "ARCHIVED"
          ? "bg-panel-muted text-ink-soft"
          : "bg-panel-muted text-foreground";

  return (
    <span role="status" className={cn(badgeBase, tone, className)}>
      {assignmentStatusLabels[status]}
    </span>
  );
}

export function AssignmentTypeBadge({ type, className }: { type: AssignmentType; className?: string }) {
  return (
    <span role="status" className={cn(badgeBase, "bg-panel-muted text-foreground", className)}>
      {assignmentTypeLabels[type]}
    </span>
  );
}

export function AssignmentSubmissionStatusBadge({ status, className }: { status: AssignmentSubmissionStatus; className?: string }) {
  const tone =
    status === "SUBMITTED"
      ? "bg-accent-soft text-accent-strong"
      : status === "LATE" || status === "NEEDS_REVIEW"
        ? "bg-warning-soft text-warning"
        : "bg-panel-muted text-foreground";

  return (
    <span role="status" className={cn(badgeBase, tone, className)}>
      {assignmentSubmissionStatusLabels[status]}
    </span>
  );
}
