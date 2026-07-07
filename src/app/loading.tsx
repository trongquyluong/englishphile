import { LoadingNotice, SkeletonCard, SkeletonHeroCard } from "@/components/ui/SkeletonCards";

export default function Loading() {
  return (
    <div className="grid gap-6 py-4 sm:py-6">
      <LoadingNotice label="Đang tải trang..." />
      <SkeletonHeroCard />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <SkeletonCard key={item} lines={3} className="h-40" />
        ))}
      </div>
    </div>
  );
}
