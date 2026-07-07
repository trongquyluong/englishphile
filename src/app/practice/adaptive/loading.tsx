import { LoadingNotice, SkeletonCard } from "@/components/ui/SkeletonCards";

export default function AdaptivePracticeLoading() {
  return (
    <div className="grid gap-6">
      <LoadingNotice label="Đang chuẩn bị bài luyện..." />

      {/* Hero skeleton */}
      <div className="surface-mint animate-pulse rounded-3xl p-6 sm:p-8" aria-hidden="true">
        <div className="flex gap-4">
          <div className="size-11 shrink-0 rounded-2xl bg-accent-soft" />
          <div className="grid flex-1 gap-2">
            <div className="h-3 w-16 rounded-md bg-panel-muted" />
            <div className="h-8 w-full max-w-xs rounded-md bg-panel-muted" />
            <div className="h-3.5 w-full max-w-lg rounded-md bg-panel-muted" />
          </div>
        </div>
      </div>

      {/* Config skeleton */}
      <div className="surface animate-pulse rounded-3xl p-5" aria-hidden="true">
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid gap-2">
              <div className="h-3 w-16 rounded-md bg-panel-muted" />
              <div className="h-11 rounded-2xl bg-panel-muted" />
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
