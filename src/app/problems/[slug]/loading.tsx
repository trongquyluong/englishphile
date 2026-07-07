import { SkeletonCard } from "@/components/ui/SkeletonCards";

export default function ProblemDetailLoading() {
  return (
    <div className="grid gap-5">
      {/* Problem header skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-5" aria-hidden="true">
        <div className="grid gap-2">
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded-md bg-panel" />
            <div className="h-5 w-16 rounded-md bg-panel" />
          </div>
          <div className="h-7 w-72 rounded-md bg-panel" />
          <div className="mt-1 h-3 w-40 rounded-md bg-panel" />
          <div className="mt-2 h-3.5 w-full rounded-md bg-panel" />
          <div className="h-3.5 w-3/4 rounded-md bg-panel" />
        </div>
      </div>

      {/* Problem body skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-5" aria-hidden="true">
        {/* Tab bar */}
        <div className="flex gap-2 border-b border-line pb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-16 rounded-lg bg-panel" />
          ))}
        </div>
        {/* Content */}
        <div className="mt-4 grid gap-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </div>
  );
}
