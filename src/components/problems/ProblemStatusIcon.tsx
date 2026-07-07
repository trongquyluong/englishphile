import type { ProblemStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Circle, Clock3, XCircle } from "lucide-react";
import { problemStatusLabels } from "@/lib/labels";

type ProblemStatusIconProps = {
  status: ProblemStatus;
};

export function ProblemStatusIcon({ status }: ProblemStatusIconProps) {
  const iconClass = "size-5";

  if (status === "SOLVED") {
    return <CheckCircle2 className={`${iconClass} text-accent`} aria-label={problemStatusLabels[status]} />;
  }

  if (status === "WRONG") {
    return <XCircle className={`${iconClass} text-danger`} aria-label={problemStatusLabels[status]} />;
  }

  if (status === "NEEDS_REVIEW") {
    return <AlertTriangle className={`${iconClass} text-warning`} aria-label={problemStatusLabels[status]} />;
  }

  if (status === "ATTEMPTED") {
    return <Clock3 className={`${iconClass} text-ink-soft`} aria-label={problemStatusLabels[status]} />;
  }

  return <Circle className={`${iconClass} text-line-strong`} aria-label={problemStatusLabels[status]} />;
}
