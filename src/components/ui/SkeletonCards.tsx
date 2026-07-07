/**
 * Reusable skeleton card for practice/quiz loading states.
 * Matches LearnerCard surface styling.
 */

type Props = {
  lines?: number;
  className?: string;
};

export function SkeletonLine({ className = "h-4 w-3/4" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-panel-muted ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3, className = "" }: Props) {
  return (
    <div className={`rounded-2xl bg-panel-muted p-5 ${className}`} aria-hidden="true">
      <div className="grid gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} className={i === 0 ? "h-4 w-2/3" : i === lines - 1 ? "h-4 w-1/2" : "h-4 w-5/6"} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonHeroCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-foreground p-6 md:p-8" aria-hidden="true">
      <div className="grid gap-2">
        <div className="h-3 w-20 rounded-md bg-white/10" />
        <div className="mt-2 h-8 w-72 rounded-md bg-white/10" />
        <div className="mt-3 grid gap-1">
          <div className="h-3.5 w-full max-w-xl rounded-md bg-white/10" />
          <div className="h-3.5 w-4/5 max-w-xl rounded-md bg-white/10" />
        </div>
      </div>
      <div className="mt-6 h-11 w-48 rounded-xl bg-white/10" />
    </div>
  );
}

export function SkeletonQuestionCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-panel-muted overflow-hidden" aria-hidden="true">
      {/* Section header */}
      <div className="border-b border-line bg-panel-muted/55 px-5 py-4">
        <div className="grid gap-2">
          <div className="h-3 w-24 rounded-md bg-panel" />
          <div className="h-5 w-48 rounded-md bg-panel" />
        </div>
      </div>
      {/* Question */}
      <div className="grid gap-3 p-5">
        <div className="grid gap-2">
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-md bg-panel" />
            <div className="h-4 w-16 rounded-md bg-panel" />
            <div className="h-4 w-12 rounded-md bg-panel" />
          </div>
          <div className="mt-2 h-4 w-full rounded-md bg-panel" />
          <div className="h-4 w-4/5 rounded-md bg-panel" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-12 items-start gap-3 rounded-xl bg-white px-4 py-3">
            <div className="size-4 rounded-full bg-panel-muted" />
            <div className="h-3.5 flex-1 rounded-md bg-panel-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
