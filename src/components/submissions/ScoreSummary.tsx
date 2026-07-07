import { submissionStatusLabels } from "@/lib/labels";
import type { SubmissionResultPayload } from "@/lib/problem-types";

export function ScoreSummary({ result }: { result: SubmissionResultPayload }) {
  return (
    <div className="rounded-lg bg-panel-muted p-4">
      <p className="text-sm font-semibold">{submissionStatusLabels[result.status as keyof typeof submissionStatusLabels] ?? result.status}</p>
      <p className="tabular mt-2 text-3xl font-semibold">
        {result.score}/{result.total}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {result.status === "NEEDS_REVIEW"
          ? "Một phần bài cần chấm thủ công."
          : "Điểm chỉ tính các câu có thể chấm tự động."}
      </p>
    </div>
  );
}
