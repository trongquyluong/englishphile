type Stat = {
  label: string;
  value: string | number;
  hint?: string;
};

export function DashboardStats({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="surface rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{stat.label}</p>
          <p className="tabular mt-3 text-2xl font-semibold tracking-tight">{stat.value}</p>
          {stat.hint ? <p className="mt-1 text-xs text-ink-soft">{stat.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
