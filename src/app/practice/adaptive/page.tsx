import Link from "next/link";
import type { Prisma, SkillType } from "@prisma/client";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireUser } from "@/lib/auth/session";
import { getRecommendedProblemsForStudent } from "@/lib/analytics/recommendations";
import { skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

const focusLabels = {
  auto: "Tự động",
  weak: "Điểm yếu",
  wrong: "Ôn lỗi sai",
  challenge: "Thử thách nâng cao",
};

export default async function AdaptivePracticePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const minutes = Number(getParam(params, "minutes") ?? 20);
  const focus = (getParam(params, "focus") ?? "auto") as keyof typeof focusLabels;
  const skill = getParam(params, "skill") as SkillType | undefined;
  const requested = Boolean(params.minutes || params.focus || params.skill);
  const take = Math.max(4, Math.min(14, Math.round(minutes / 5)));

  let problems = requested ? await getRecommendedProblemsForStudent(user.id, take) : [];
  if (requested && skill && skillOrder.includes(skill)) {
    const where: Prisma.ProblemWhereInput = {
      contentStatus: "PUBLISHED",
      skillType: skill,
      userStatuses: { none: { userId: user.id, status: "SOLVED" } },
    };
    problems = await prisma.problem.findMany({
      where,
      include: { problemTopics: { include: { topic: { select: { name: true, slug: true } } } } },
      orderBy: focus === "challenge" ? [{ difficulty: "desc" }, { orderIndex: "asc" }] : [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take,
    }).then((items) => items.map((problem) => ({ ...problem, reason: `Buổi luyện ${focusLabels[focus].toLowerCase()} trong ${minutes} phút.` })));
  }

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Adaptive practice</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Tạo buổi luyện theo mục tiêu</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Chọn thời lượng và trọng tâm. Hệ thống chỉ đề xuất bài đã xuất bản và ưu tiên bài bạn chưa giải.
            </p>
          </div>
        </div>
      </section>

      <form className="surface grid gap-3 rounded-2xl p-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm">
          <span className="font-semibold">Thời lượng</span>
          <select name="minutes" defaultValue={minutes} className="min-h-11 rounded-xl bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            {[10, 20, 30, 45].map((item) => <option key={item} value={item}>{item} phút</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-semibold">Trọng tâm</span>
          <select name="focus" defaultValue={focus} className="min-h-11 rounded-xl bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            {Object.entries(focusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-semibold">Kỹ năng</span>
          <select name="skill" defaultValue={skill ?? ""} className="min-h-11 rounded-xl bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            <option value="">Tự động chọn</option>
            {skillOrder.map((item) => <option key={item} value={item}>{skillLabels[item]}</option>)}
          </select>
        </label>
        <button className="min-h-11 self-end rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
          Tạo gợi ý
        </button>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {problems.map((problem) => (
          <Link key={problem.id} href={`/problems/${problem.slug}`} className="surface surface-hover rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-balance">{problem.title}</h2>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <div className="mt-3">
              <SkillBadge skill={problem.skillType} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-soft">{problem.reason}</p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent-strong">
              Mở bài <ArrowRight className="size-4" aria-hidden="true" />
            </div>
          </Link>
        ))}
        {!requested ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chọn cấu hình để tạo danh sách luyện</h2>
            <p className="mt-2 text-sm text-ink-soft">Bạn có thể để kỹ năng ở chế độ tự động nếu muốn luyện theo điểm yếu.</p>
          </div>
        ) : !problems.length ? (
          <div className="surface rounded-2xl p-6 md:col-span-2 xl:col-span-3">
            <h2 className="text-xl font-semibold">Chưa tìm thấy bài phù hợp</h2>
            <p className="mt-2 text-sm text-ink-soft">Thử chọn kỹ năng khác hoặc giảm bộ lọc.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
