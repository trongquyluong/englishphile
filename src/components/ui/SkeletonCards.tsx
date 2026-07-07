/**
 * Reusable skeleton cards for practice/quiz loading states.
 * Uses the mint/forest palette so skeletons look like the real cards.
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

/** Visible loading message so learners get immediate feedback. */
export function LoadingNotice({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      {label}
    </p>
  );
}

export function SkeletonCard({ lines = 3, className = "" }: Props) {
  return (
    <div className={`surface animate-pulse rounded-3xl p-6 ${className}`} aria-hidden="true">
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
    <div className="surface-mint animate-pulse rounded-3xl p-6 md:p-8" aria-hidden="true">
      <div className="grid gap-2">
        <div className="h-3 w-24 rounded-md bg-accent-soft" />
        <div className="mt-2 h-9 w-full max-w-md rounded-lg bg-panel-muted" />
        <div className="mt-3 grid gap-1.5">
          <div className="h-3.5 w-full max-w-xl rounded-md bg-panel-muted" />
          <div className="h-3.5 w-4/5 max-w-xl rounded-md bg-panel-muted" />
        </div>
      </div>
      <div className="mt-6 h-11 w-56 rounded-full bg-accent-soft" />
    </div>
  );
}

export function SkeletonQuestionCard() {
  return (
    <div className="surface animate-pulse overflow-hidden rounded-3xl" aria-hidden="true">
      {/* Section header */}
      <div className="border-b border-line bg-panel-muted/55 px-6 py-4">
        <div className="grid gap-2">
          <div className="h-3 w-24 rounded-md bg-panel-muted" />
          <div className="h-5 w-48 rounded-md bg-panel-muted" />
        </div>
      </div>
      {/* Question */}
      <div className="grid gap-3 p-6">
        <div className="grid gap-2">
          <div className="flex gap-2">
            <div className="h-6 w-14 rounded-md bg-panel-muted" />
            <div className="h-6 w-16 rounded-md bg-accent-soft/70" />
            <div className="h-6 w-12 rounded-md bg-panel-muted" />
          </div>
          <div className="mt-2 h-4 w-full rounded-md bg-panel-muted" />
          <div className="h-4 w-4/5 rounded-md bg-panel-muted" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-12 items-start gap-3 rounded-2xl bg-panel-muted/60 px-4 py-3">
            <div className="size-4 rounded-full bg-panel" />
            <div className="h-3.5 flex-1 rounded-md bg-panel" />
          </div>
        ))}
      </div>
    </div>
  );
}
