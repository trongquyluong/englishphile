import { SkeletonCard } from "@/components/ui/SkeletonCards";

export default function AdaptivePracticeLoading() {
  return (
    <div className="grid gap-6">
      {/* Hero skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-6" aria-hidden="true">
        <div className="flex gap-4">
          <div className="size-11 rounded-xl bg-panel shrink-0" />
          <div className="grid gap-2 flex-1">
            <div className="h-3 w-16 rounded-md bg-panel" />
            <div className="h-8 w-72 rounded-md bg-panel" />
            <div className="h-3.5 w-full max-w-lg rounded-md bg-panel" />
          </div>
        </div>
      </div>

      {/* Config skeleton */}
      <div className="animate-pulse rounded-2xl bg-panel-muted p-4" aria-hidden="true">
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid gap-2">
              <div className="h-3 w-16 rounded-md bg-panel" />
              <div className="h-11 rounded-xl bg-panel" />
            </div>
          ))}
        </div>
      </div>

      {/* Problem grid skeleton */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} lines={4} className="h-40" />
        ))}
      </div>
    </div>
  );
}
