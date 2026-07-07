import { SkeletonCard, SkeletonHeroCard } from "@/components/ui/SkeletonCards";

export default function DiagnosticLoading() {
  return (
    <div className="grid gap-6">
      <SkeletonHeroCard />
      <SkeletonCard lines={4} className="h-48" />
      <div className="grid gap-3 md:grid-cols-2">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
