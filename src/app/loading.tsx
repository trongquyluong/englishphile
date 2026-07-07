export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface rounded-2xl p-6">
        <div className="h-4 w-28 animate-pulse rounded-full bg-panel-muted" />
        <div className="mt-4 h-9 max-w-xl animate-pulse rounded-lg bg-panel-muted" />
        <div className="mt-3 h-4 max-w-2xl animate-pulse rounded-full bg-panel-muted" />
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="surface rounded-2xl p-5">
            <div className="h-5 w-24 animate-pulse rounded-full bg-panel-muted" />
            <div className="mt-4 h-20 animate-pulse rounded-xl bg-panel-muted" />
          </div>
        ))}
      </section>
    </main>
  );
}
