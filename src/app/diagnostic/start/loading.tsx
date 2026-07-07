import { SkeletonQuestionCard } from "@/components/ui/SkeletonCards";

export default function DiagnosticStartLoading() {
  return (
    <div className="grid gap-5">
      {/* Back link skeleton */}
      <div className="animate-pulse rounded-lg bg-panel-muted px-4 py-2.5 w-32 h-10" aria-hidden="true" />

      {/* Progress header skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-5" aria-hidden="true">
        <div className="grid gap-3">
          <div className="h-3 w-20 rounded-md bg-panel" />
          <div className="h-7 w-64 rounded-md bg-panel" />
          <div className="h-3.5 w-full max-w-lg rounded-md bg-panel" />
        </div>
        <div className="mt-4 flex gap-3">
          <div className="h-10 w-36 rounded-xl bg-panel" />
          <div className="h-10 w-36 rounded-xl bg-panel" />
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-panel" />
      </div>

      {/* Question cards skeleton */}
      <SkeletonQuestionCard />
      <SkeletonQuestionCard />
    </div>
  );
}
