import { LoadingNotice, SkeletonQuestionCard } from "@/components/ui/SkeletonCards";

export default function ContestStartLoading() {
  return (
    <div className="grid gap-6">
      <LoadingNotice label="Đang mở đề..." />

      {/* Header skeleton */}
      <div className="surface animate-pulse rounded-3xl p-6" aria-hidden="true">
        <div className="grid gap-2">
          <div className="h-3 w-16 rounded-md bg-accent-soft" />
          <div className="h-8 w-full max-w-sm rounded-md bg-panel-muted" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-panel-muted" />
            <div className="h-6 w-40 rounded-full bg-panel-muted" />
          </div>
        </div>
      </div>

      {/* Question skeletons */}
      <SkeletonQuestionCard />
      <SkeletonQuestionCard />

      {/* Submit bar skeleton */}
      <div className="sticky bottom-4 z-10 flex animate-pulse items-center justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-[var(--shadow-float)]">
        <div className="h-11 w-28 rounded-full bg-panel-muted" />
        <div className="h-11 w-28 rounded-full bg-accent-soft" />
      </div>
    </div>
  );
}
