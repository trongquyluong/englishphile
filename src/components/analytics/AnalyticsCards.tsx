import { cn } from "@/lib/utils";

export function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="surface rounded-lg p-5">
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function AccuracyBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-2 rounded-full bg-panel-muted">
      <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${width}%` }} />
    </div>
  );
}

export function StatusPill({ label }: { label: string }) {
  const tone =
    label === "Mạnh"
      ? "bg-accent-soft text-accent-strong"
      : label === "Ổn"
        ? "bg-blue-50 text-blue-800"
        : label === "Cần luyện thêm"
          ? "bg-amber-100 text-amber-900"
          : label === "Yếu"
            ? "bg-red-50 text-danger"
            : "bg-panel-muted text-ink-soft";
  return <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-semibold", tone)}>{label}</span>;
}

export function SimpleDistributionBar({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-ink-soft">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-panel-muted">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
