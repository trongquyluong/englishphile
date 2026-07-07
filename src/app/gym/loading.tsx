import { LoadingNotice, SkeletonCard, SkeletonHeroCard } from "@/components/ui/SkeletonCards";

export default function GymLoading() {
  return (
    <div className="grid gap-6">
      <LoadingNotice label="Đang chuẩn bị bài luyện..." />
      <SkeletonHeroCard />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} lines={2} className="h-36" />
        ))}
      </div>
      <SkeletonCard lines={3} className="h-48" />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SkeletonCard lines={4} className="h-56" />
        <SkeletonCard lines={4} className="h-56" />
      </div>
    </div>
  );
}
