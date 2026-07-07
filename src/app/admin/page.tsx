import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import {
  BookOpenCheck,
  Database,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Medal,
  Rocket,
  ShieldCheck,
  Tags,
  TestTube2,
} from "lucide-react";
import { ContentStatusBadge, DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type LifecycleCard = [string, number, ContentStatus];

const adminActions = [
  { label: "Import JSON", icon: FileJson, href: "/admin/import" },
  { label: "Import CSV", icon: FileSpreadsheet, href: "/admin/import" },
  { label: "Content packs", icon: FileArchive, href: "/admin/content-packs" },
  { label: "Content QA", icon: ShieldCheck, href: "/admin/content-qa" },
  { label: "Duyệt nội dung", icon: ListChecks, href: "/admin/review" },
  { label: "Import PDF later", icon: FileText },
  { label: "Create contest", icon: TestTube2, href: "/admin/contests/new" },
  { label: "Beta checklist", icon: Rocket, href: "/admin/beta-checklist" },
];

const adminCards = [
  { label: "Import dữ liệu", description: "JSON/CSV dry-run, preview và import history.", href: "/admin/import", icon: FileArchive },
  { label: "Gói dữ liệu", description: "Quản lý content pack, manifest và trace import.", href: "/admin/content-packs", icon: FileArchive },
  { label: "Kiểm tra chất lượng", description: "Chạy QA, phát hiện lỗi và publish bài hợp lệ.", href: "/admin/content-qa", icon: ShieldCheck },
  { label: "Duyệt nội dung", description: "Queue bản nháp và nội dung cần duyệt.", href: "/admin/review", icon: ListChecks },
  { label: "Quản lý kho bài", description: "Chỉnh sửa, publish, archive và bulk update.", href: "/admin/problems", icon: BookOpenCheck },
  { label: "Nguồn tài liệu", description: "Source collections và bài liên quan.", href: "/admin/sources", icon: FileText },
  { label: "Topic", description: "Topic, parent topic và problem liên quan.", href: "/admin/topics", icon: Tags },
  { label: "Contests", description: "Tạo đề thi cũ hoặc contest theo thời gian.", href: "/admin/contests", icon: Medal },
  { label: "Diagnostic Bank", description: "Theo dõi nguồn câu hỏi cho diagnostic.", href: "/admin/diagnostic", icon: TestTube2 },
  { label: "Checklist beta", description: "Kiểm tra env, backup, nội dung và trang pháp lý trước khi mở beta.", href: "/admin/beta-checklist", icon: Rocket },
];

export default async function AdminPage() {
  await requireAdmin();

  const [
    users,
    problems,
    questions,
    submissions,
    sourceCollections,
    imports,
    contentPacks,
    lifecycleCounts,
    recentImports,
    bank,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.problem.count(),
    prisma.question.count(),
    prisma.submission.count(),
    prisma.sourceCollection.count(),
    prisma.importBatch.count(),
    prisma.contentPack.count(),
    Promise.all([
      prisma.problem.count({ where: { contentStatus: "NEEDS_REVIEW" } }),
      prisma.problem.count({ where: { contentStatus: "DRAFT" } }),
      prisma.problem.count({ where: { contentStatus: "PUBLISHED" } }),
      prisma.problem.count({ where: { contentStatus: "ARCHIVED" } }),
    ]),
    prisma.importBatch.findMany({
      include: { sourceCollection: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.problem.findMany({
      include: { sourceCollection: true, _count: { select: { questions: true } } },
      orderBy: { orderIndex: "asc" },
      take: 50,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Quản trị</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Quản lý nội dung</h1>
        <p className="mt-2 text-sm text-ink-soft">Trang dành cho người điều hành nội dung Englishphile.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          ["Users", users],
          ["Problems", problems],
          ["Questions", questions],
          ["Submissions", submissions],
          ["Source collections", sourceCollections],
          ["Import batches", imports],
          ["Content packs", contentPacks],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-lg p-4">
            <Database className="size-4 text-accent" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
            <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Problems needing review", lifecycleCounts[0], "NEEDS_REVIEW" as const],
          ["Draft problems", lifecycleCounts[1], "DRAFT" as const],
          ["Published problems", lifecycleCounts[2], "PUBLISHED" as const],
          ["Archived problems", lifecycleCounts[3], "ARCHIVED" as const],
        ] satisfies LifecycleCard[]).map(([label, value, status]) => (
          <div key={label} className="surface rounded-lg p-4">
            <ContentStatusBadge status={status} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</p>
            <p className="tabular-nums mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Khu vực quản trị</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {adminCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href + card.label}
                href={card.href}
                className="surface-hover rounded-lg bg-white p-4 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]"
              >
                <Icon className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{card.label}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-soft">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Content actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {adminActions.map((action) => {
            const Icon = action.icon;
            const className =
              "inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold text-ink-soft";
            return action.href ? (
              <Link key={action.label} href={action.href} className={className}>
                <Icon className="size-4" aria-hidden="true" />
                {action.label}
              </Link>
            ) : (
              <button key={action.label} type="button" className={className} disabled>
                <Icon className="size-4" aria-hidden="true" />
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold">Recent import batches</h2>
        <div className="mt-4 grid gap-2">
          {recentImports.length ? (
            recentImports.map((batch) => (
              <Link key={batch.id} href="/admin/import" className="rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                <span className="font-semibold">{batch.importType}</span>
                <span className="text-ink-soft"> Â· {batch.sourceCollection?.name ?? "Nhiá»u nguá»“n"} Â· {batch.createdAt.toLocaleString("vi-VN")}</span>
              </Link>
            ))
          ) : (
            <p className="rounded-md bg-panel-muted p-3 text-sm text-ink-soft">Chưa có import batch.</p>
          )}
        </div>
      </section>

      <section className="surface overflow-hidden rounded-lg">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">Seeded question bank</h2>
        </div>
        <div className="divide-y divide-line">
          {bank.map((problem) => (
            <div
              key={problem.id}
              className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_130px_150px_110px_120px_1fr] lg:items-center"
            >
              <div>
                <Link href={`/admin/problems/${problem.id}`} className="font-semibold hover:text-accent-strong">
                  {problem.title}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">{problem._count.questions} câu</p>
              </div>
              <ContentStatusBadge status={problem.contentStatus} />
              <SkillBadge skill={problem.skillType} />
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className="text-sm text-ink-soft">{problem.questionType}</span>
              <span className="text-sm text-ink-soft">{problem.sourceCollection?.name ?? "Manual"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
