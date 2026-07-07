import { LoadingNotice, SkeletonQuestionCard } from "@/components/ui/SkeletonCards";

export default function DiagnosticStartLoading() {
  return (
    <div className="grid gap-5">
      <LoadingNotice label="Đang mở bài đang làm..." />

      {/* Progress header skeleton */}
      <div className="surface animate-pulse rounded-3xl p-6" aria-hidden="true">
        <div className="grid gap-3">
          <div className="h-3 w-24 rounded-md bg-accent-soft" />
          <div className="h-7 w-64 rounded-md bg-panel-muted" />
          <div className="h-3.5 w-full max-w-lg rounded-md bg-panel-muted" />
        </div>
        <div className="mt-5 h-2 w-full rounded-full bg-panel-muted" />
      </div>

      {/* Question cards skeleton */}
      <SkeletonQuestionCard />
      <SkeletonQuestionCard />
    </div>
  );
}
