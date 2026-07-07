import { SkeletonQuestionCard } from "@/components/ui/SkeletonCards";

export default function ContestStartLoading() {
  return (
    <div className="grid gap-6">
      {/* Header skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-5" aria-hidden="true">
        <div className="grid gap-2">
          <div className="h-3 w-16 rounded-md bg-panel" />
          <div className="h-8 w-72 rounded-md bg-panel" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-20 rounded-lg bg-panel" />
            <div className="h-6 w-32 rounded-lg bg-panel" />
          </div>
        </div>
      </div>

      {/* Question skeletons */}
      <SkeletonQuestionCard />
      <SkeletonQuestionCard />

      {/* Submit bar skeleton */}
      <div className="animate-pulse sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl bg-panel p-3">
        <div className="h-10 w-24 rounded-lg bg-panel-muted" />
        <div className="h-10 w-24 rounded-lg bg-panel-muted" />
      </div>
    </div>
  );
}
