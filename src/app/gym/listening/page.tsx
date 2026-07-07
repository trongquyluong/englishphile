import Link from "next/link";
import { Headphones, Radio, ScrollText } from "lucide-react";
import { DifficultyBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function GymListeningPage() {
  const user = await getCurrentUser();
  const [problems, profile] = await Promise.all([
    prisma.problem.findMany({
      where: { contentStatus: "PUBLISHED", skillType: "LISTENING" },
      orderBy: [{ difficulty: "asc" }, { orderIndex: "asc" }],
      take: 36,
    }),
    user ? prisma.userSkillProfile.findUnique({ where: { userId_skillType: { userId: user.id, skillType: "LISTENING" } } }) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Gym / Listening</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Listening Gym đang được chuẩn bị</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Englishphile đã có cấu trúc cho audio URL, transcript và câu hỏi nghe. Khi nội dung nghe được duyệt, bài luyện sẽ xuất hiện tại đây.
            </p>
          </div>
        </div>
      </section>

      {user ? (
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-semibold">Trạng thái Listening</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {profile?.attempted
              ? `Bạn đã có ${profile.attempted} câu Listening trong hồ sơ.`
              : "Chưa có dữ liệu Listening. Diagnostic sẽ bỏ qua phần này cho đến khi có nội dung đã publish."}
          </p>
        </section>
      ) : null}

      {problems.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {problems.map((problem) => (
            <Link key={problem.id} href={`/problems/${problem.slug}`} className="surface surface-hover rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-balance">{problem.title}</h2>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">{problem.statement}</p>
            </Link>
          ))}
        </section>
      ) : (
        <section className="surface rounded-2xl p-8 text-center">
          <Radio className="mx-auto size-9 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Chưa có bài nghe đã xuất bản</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Trang này không bị bỏ trống: hệ thống đã sẵn sàng nhận nội dung Listening qua import/QA, nhưng chưa cần audio thật ở giai đoạn này.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/diagnostic" className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
              Làm diagnostic
            </Link>
            <Link href="/gym/use-of-english" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-4 text-sm font-semibold">
              <ScrollText className="size-4" aria-hidden="true" />
              Luyện Use of English
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
