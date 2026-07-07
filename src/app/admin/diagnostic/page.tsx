import Link from "next/link";
import type { Difficulty, SkillType } from "@prisma/client";
import { Activity, CheckCircle2, Info, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { updateDiagnosticEligibilityAction } from "@/app/admin/diagnostic/actions";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { requireAdmin } from "@/lib/auth/session";
import { diagnosticBlueprint, getDiagnosticCoverage, getGymAreaForSkill } from "@/lib/diagnostic-blueprint";
import { difficultyLabels, difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function statusTone(status: "enough" | "missing" | "empty") {
  if (status === "enough") return "bg-accent-soft text-accent-strong";
  if (status === "missing") return "bg-amber-50 text-warning";
  return "bg-red-50 text-danger";
}

function statusLabel(status: "enough" | "missing" | "empty") {
  if (status === "enough") return "Đủ câu hỏi";
  if (status === "missing") return "Thiếu câu hỏi";
  return "Chưa có dữ liệu";
}

export default async function AdminDiagnosticBankPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const skill = getParam(params, "skill") as SkillType | undefined;
  const difficulty = getParam(params, "difficulty") as Difficulty | undefined;
  const message = getParam(params, "message");

  const coverage = await getDiagnosticCoverage();
  const where = {
    contentStatus: "PUBLISHED" as const,
    ...(skill && skillOrder.includes(skill) ? { skillType: skill } : {}),
    ...(difficulty && difficultyOrder.includes(difficulty) ? { difficulty } : {}),
  };
  const problems = await prisma.problem.findMany({
    where,
    include: {
      sourceCollection: { select: { name: true } },
      _count: { select: { questions: true } },
    },
    orderBy: [{ isDiagnosticEligible: "desc" }, { skillType: "asc" }, { difficulty: "asc" }, { orderIndex: "asc" }],
    take: 120,
  });

  const gymAreas = ["Use of English", "Reading", "Writing", "Listening"].map((area) => {
    const skills = skillOrder.filter((item) => getGymAreaForSkill(item) === area);
    const rows = coverage.bySkill.filter((item) => skills.includes(item.skillType));
    return {
      area,
      eligibleProblems: rows.reduce((sum, item) => sum + item.eligibleProblems, 0),
      publishedProblems: rows.reduce((sum, item) => sum + item.publishedProblems, 0),
      eligibleQuestions: rows.reduce((sum, item) => sum + item.eligibleQuestions, 0),
      publishedQuestions: rows.reduce((sum, item) => sum + item.publishedQuestions, 0),
    };
  });

  return (
    <div className="grid gap-6">
      <header className="surface rounded-2xl p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">Quản trị diagnostic</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Diagnostic Bank</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Theo dõi độ phủ của bài kiểm tra đầu vào và đánh dấu problem đã publish làm nguồn diagnostic. Eligibility là tùy chọn, không ảnh hưởng QA.
            </p>
          </div>
          <Link href="/diagnostic" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
            Xem trang diagnostic
          </Link>
        </div>
        {message ? <p className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">{message}</p> : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {gymAreas.map((area) => (
          <article key={area.area} className="surface rounded-2xl p-5">
            <p className="text-sm font-semibold text-accent">{area.area}</p>
            <p className="tabular-nums mt-3 text-3xl font-semibold">{area.eligibleQuestions}</p>
            <p className="mt-1 text-sm text-ink-soft">câu eligible / {area.publishedQuestions} câu đã publish</p>
            <p className="mt-3 text-xs text-ink-soft">{area.eligibleProblems}/{area.publishedProblems} problems diagnostic-ready</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Coverage theo blueprint</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {coverage.sections.map((section) => (
              <div key={section.id} className="rounded-xl bg-white p-3 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{section.title}</span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone(section.status)}`}>
                    {statusLabel(section.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {section.eligibleQuestions}/{section.targetCount || "optional"} câu eligible · {section.publishedQuestions} câu đã publish
                </p>
                <p className="mt-1 text-xs text-ink-soft">{section.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-warning" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Gợi ý cho quản trị</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {coverage.warnings.length ? (
              coverage.warnings.map((warning) => (
                <p key={warning} className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-medium text-warning">
                  {warning}
                </p>
              ))
            ) : (
              <p className="rounded-xl bg-accent-soft px-3 py-3 text-sm font-medium text-accent-strong">Diagnostic bank đang đủ dữ liệu cơ bản.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Info className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Blueprint hiện tại</h2>
        </div>
        <div className="mt-4 grid gap-2">
          {diagnosticBlueprint.map((section) => (
            <div key={section.id} className="rounded-xl bg-panel-muted p-3 text-sm">
              <p className="font-semibold">{section.title}</p>
              <p className="mt-1 text-ink-soft">{section.items.map((item) => `${item.label}: ${item.targetCount}`).join(" Â· ")}</p>
            </div>
          ))}
        </div>
      </section>

      <form className="surface grid gap-3 rounded-2xl p-4 md:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Skill
          <select name="skill" defaultValue={skill ?? ""} className="min-h-10 rounded-lg bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            <option value="">Tất cả</option>
            {skillOrder.map((item) => (
              <option key={item} value={item}>{skillLabels[item]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Độ khó
          <select name="difficulty" defaultValue={difficulty ?? ""} className="min-h-10 rounded-lg bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
            <option value="">Tất cả</option>
            {difficultyOrder.map((item) => (
              <option key={item} value={item}>{difficultyLabels[item]}</option>
            ))}
          </select>
        </label>
        <button className="min-h-10 self-end rounded-lg bg-panel-muted px-3 text-sm font-semibold">Lọc problem</button>
      </form>

      <form action={updateDiagnosticEligibilityAction} className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Published problems</h2>
            <p className="mt-1 text-sm text-ink-soft">Chọn problem để đưa vào hoặc gỡ khỏi diagnostic bank.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">
              Weight
              <input name="diagnosticWeight" type="number" min="1" max="5" defaultValue="1" className="min-h-10 rounded-lg bg-white px-3 text-sm text-foreground shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">
              Min
              <select name="recommendedMinLevel" className="min-h-10 rounded-lg bg-white px-3 text-sm text-foreground shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
                <option value="">-</option>
                {difficultyOrder.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink-soft">
              Max
              <select name="recommendedMaxLevel" className="min-h-10 rounded-lg bg-white px-3 text-sm text-foreground shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]">
                <option value="">-</option>
                {difficultyOrder.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button name="intent" value="mark" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Mark
            </button>
            <button name="intent" value="remove" className="min-h-10 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
              Remove
            </button>
          </div>
        </div>
        <div className="divide-y divide-line">
          {problems.map((problem) => (
            <label key={problem.id} className="grid cursor-pointer gap-3 px-4 py-3 text-sm hover:bg-panel-muted/60 lg:grid-cols-[28px_minmax(220px,1fr)_150px_100px_120px_120px] lg:items-center">
              <input type="checkbox" name="problemId" value={problem.id} className="mt-1 accent-[var(--accent)] lg:mt-0" />
              <div>
                <p className="font-semibold">{problem.title}</p>
                <p className="mt-1 text-xs text-ink-soft">{problem.sourceCollection?.name ?? "Manual"} Â· {problem._count.questions} cÃ¢u</p>
              </div>
              <SkillBadge skill={problem.skillType} />
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className={problem.isDiagnosticEligible ? "text-sm font-semibold text-accent-strong" : "text-sm text-ink-soft"}>
                {problem.isDiagnosticEligible ? "Eligible" : "Chưa chọn"}
              </span>
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                <SlidersHorizontal className="size-3" aria-hidden="true" />
                weight {problem.diagnosticWeight}
              </span>
            </label>
          ))}
          {!problems.length ? <p className="p-5 text-sm text-ink-soft">Không có published problem theo bộ lọc này.</p> : null}
        </div>
      </form>
    </div>
  );
}
