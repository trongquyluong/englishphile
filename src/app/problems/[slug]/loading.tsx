import { LoadingNotice } from "@/components/ui/SkeletonCards";

export default function ProblemDetailLoading() {
  return (
    <div className="grid gap-5">
      <LoadingNotice label="Đang tải câu hỏi..." />

      {/* Problem header skeleton */}
      <div className="surface animate-pulse rounded-3xl p-6" aria-hidden="true">
        <div className="grid gap-2">
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-md bg-accent-soft/70" />
            <div className="h-6 w-16 rounded-md bg-panel-muted" />
          </div>
          <div className="h-7 w-full max-w-sm rounded-md bg-panel-muted" />
          <div className="mt-1 h-3 w-40 rounded-md bg-panel-muted" />
          <div className="mt-2 h-3.5 w-full rounded-md bg-panel-muted" />
          <div className="h-3.5 w-3/4 rounded-md bg-panel-muted" />
        </div>
      </div>

      {/* Problem body skeleton */}
      <div className="surface animate-pulse rounded-3xl p-6" aria-hidden="true">
        {/* Tab bar */}
        <div className="flex gap-2 border-b border-line pb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-16 rounded-full bg-panel-muted" />
          ))}
        </div>
        {/* Content */}
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <div className="h-4 w-full rounded-md bg-panel-muted" />
            <div className="h-4 w-5/6 rounded-md bg-panel-muted" />
            <div className="h-4 w-2/3 rounded-md bg-panel-muted" />
          </div>
          <div className="grid gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-2xl bg-panel-muted/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
