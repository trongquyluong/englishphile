import type { Metadata } from "next";
import Link from "next/link";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { AlertTriangle, CheckCircle2, CircleDashed, DatabaseBackup, ExternalLink, ShieldCheck, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getDiagnosticCoverage } from "@/lib/diagnostic-blueprint";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Checklist beta",
  description: "Checklist trước khi mở beta Englishphile.",
};

type ChecklistStatus = "ok" | "warning" | "missing";

type ChecklistItem = {
  label: string;
  detail: string;
  status: ChecklistStatus;
  href?: string;
};

function summaryNumber(summary: unknown, key: string) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return 0;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

async function pageExists(routePath: string) {
  try {
    await access(path.join(/* turbopackIgnore: true */ process.cwd(), routePath));
    return true;
  } catch {
    return false;
  }
}

async function getLatestExport() {
  const exportDir = path.join(/* turbopackIgnore: true */ process.cwd(), "exports");

  try {
    const files = await readdir(exportDir, { withFileTypes: true });
    const exports = await Promise.all(
      files
        .filter((file) => file.isDirectory() && file.name.startsWith("englishphile"))
        .map(async (file) => {
          const filePath = path.join(exportDir, file.name);
          const info = await stat(filePath);
          return { name: file.name, path: filePath, mtime: info.mtime };
        }),
    );

    return exports.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ?? null;
  } catch {
    return null;
  }
}

async function getLatestBackup() {
  const backupDir = path.join(/* turbopackIgnore: true */ process.cwd(), "backups");

  try {
    const files = await readdir(backupDir, { withFileTypes: true });
    const backups = await Promise.all(
      files
        .filter((file) => file.isFile() && file.name.endsWith(".db"))
        .map(async (file) => {
          const filePath = path.join(backupDir, file.name);
          const info = await stat(filePath);
          return { name: file.name, path: filePath, mtime: info.mtime };
        }),
    );

    return backups.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ?? null;
  } catch {
    return null;
  }
}

function StatusIcon({ status }: { status: ChecklistStatus }) {
  if (status === "ok") return <CheckCircle2 className="size-5 text-accent" aria-hidden="true" />;
  if (status === "warning") return <AlertTriangle className="size-5 text-warning" aria-hidden="true" />;
  return <XCircle className="size-5 text-danger" aria-hidden="true" />;
}

export default async function AdminBetaChecklistPage() {
  await requireAdmin();

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const sessionSecret = process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? "";
  const hasRealSecret = sessionSecret !== "" && sessionSecret !== "replace-with-a-long-random-secret" && !sessionSecret.includes("local-development-secret-change-before-deploy");
  const [
    ownerUser,
    totalUsers,
    publishedProblems,
    needsReviewProblems,
    diagnosticEligibleProblems,
    contentPacks,
    activeContests,
    diagnosticAttempts,
    importBatches,
    latestBackup,
    latestExport,
    pages,
    coverage,
  ] = await Promise.all([
    ownerEmail ? prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true, email: true, role: true } }) : Promise.resolve(null),
    prisma.user.count(),
    prisma.problem.count({ where: { contentStatus: "PUBLISHED" } }),
    prisma.problem.count({ where: { contentStatus: "NEEDS_REVIEW" } }),
    prisma.problem.count({ where: { contentStatus: "PUBLISHED", isDiagnosticEligible: true } }),
    prisma.contentPack.count(),
    prisma.contest.count({ where: { visibility: "PUBLIC", status: { in: ["SCHEDULED", "LIVE"] } } }),
    prisma.diagnosticAttempt.count({ where: { status: "COMPLETED" } }),
    prisma.importBatch.findMany({ select: { summary: true } }),
    getLatestBackup(),
    getLatestExport(),
    Promise.all([
      pageExists("src/app/privacy/page.tsx"),
      pageExists("src/app/terms/page.tsx"),
      pageExists("src/app/contact/page.tsx"),
    ]),
    getDiagnosticCoverage(),
  ]);

  const duplicateWarnings = importBatches.reduce(
    (sum, batch) =>
      sum +
      summaryNumber(batch.summary, "duplicateQuestionsSkipped") +
      summaryNumber(batch.summary, "possibleDuplicateQuestionsFlagged"),
    0,
  );
  const requiredCoverage = coverage.sections.filter((section) => section.id !== "writing" && section.id !== "listening");
  const diagnosticCoverageOk = requiredCoverage.every((section) => section.status === "enough" || section.publishedQuestions >= section.targetCount);
  const legalPagesOk = pages.every(Boolean);

  const checklist: ChecklistItem[] = [
    {
      label: "Đã cấu hình admin",
      detail: ownerEmail
        ? ownerUser
          ? `OWNER_EMAIL khớp với ${ownerUser.email}.`
          : "OWNER_EMAIL đã có nhưng chưa tìm thấy tài khoản. Hãy sign up bằng email này hoặc chạy script promote sau khi tạo tài khoản."
        : "Chưa cấu hình OWNER_EMAIL.",
      status: ownerEmail && ownerUser ? "ok" : "missing",
      href: "/admin",
    },
    {
      label: "Đã cấu hình session secret",
      detail: hasRealSecret
        ? "SESSION_SECRET đã được đặt giá trị thực."
        : "SESSION_SECRET vẫn là placeholder. Cần đặt secret thực trước khi deploy.",
      status: hasRealSecret ? "ok" : isProduction ? "missing" : "warning",
    },
    {
      label: "Đã cấu hình production DATABASE_URL",
      detail: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.startsWith("file:")
          ? "DATABASE_URL trỏ đến SQLite. Cần đổi sang Neon PostgreSQL cho production."
          : "DATABASE_URL đã trỏ đến PostgreSQL."
        : "Chưa có DATABASE_URL.",
      status: process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:") ? "ok" : isProduction ? "missing" : "warning",
    },
    {
      label: "Đã có bài published",
      detail: `${publishedProblems} problem đã xuất bản.`,
      status: publishedProblems > 0 ? "ok" : "missing",
      href: "/admin/problems",
    },
    {
      label: "Diagnostic đủ dữ liệu",
      detail: diagnosticCoverageOk
        ? `${diagnosticEligibleProblems} problem đang được đánh dấu diagnostic-eligible. Fallback published content sẵn sàng.`
        : "Diagnostic bank còn thiếu dữ liệu ở một số section bắt buộc.",
      status: diagnosticCoverageOk ? "ok" : "warning",
      href: "/admin/diagnostic",
    },
    {
      label: "Đã backup database",
      detail: latestBackup
        ? `Backup gần nhất: ${latestBackup.name} (${latestBackup.mtime.toLocaleString("vi-VN")}).`
        : "Chưa tìm thấy file backup trong thư mục backups/.",
      status: latestBackup ? "ok" : "warning",
    },
    {
      label: "Đã export portable data",
      detail: latestExport
        ? `Export gần nhất: ${latestExport.name} (${latestExport.mtime.toLocaleString("vi-VN")}).`
        : "Chưa tìm thấy portable export. Chạy npm run db:export:portable để tạo bản export cho production.",
      status: latestExport ? "ok" : "warning",
    },
    {
      label: "Còn nội dung cần duyệt",
      detail: `${needsReviewProblems} problem đang ở trạng thái cần duyệt.`,
      status: needsReviewProblems === 0 ? "ok" : "warning",
      href: "/admin/review",
    },
    {
      label: "Duplicate guardrails",
      detail: duplicateWarnings
        ? `${duplicateWarnings} duplicate/possible duplicate đã được ghi nhận từ import.`
        : "Chưa ghi nhận duplicate warning từ import batch.",
      status: duplicateWarnings ? "warning" : "ok",
      href: "/admin/content-packs",
    },
    {
      label: "Contests public",
      detail: `${activeContests} contest public đang mở hoặc đã lên lịch.`,
      status: activeContests > 0 ? "ok" : "warning",
      href: "/admin/contests",
    },
    {
      label: "Trang pháp lý beta",
      detail: legalPagesOk ? "Privacy, Terms và Contact đã tồn tại." : "Thiếu ít nhất một trang Privacy/Terms/Contact.",
      status: legalPagesOk ? "ok" : "missing",
      href: "/privacy",
    },
  ];

  return (
    <div className="grid gap-6">
      {/* Production deployment warning */}
      {isProduction && (
        <section className="surface rounded-2xl border-danger/30 bg-danger/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="font-semibold text-danger">Cảnh báo: Production mode đang bật</p>
              <p className="mt-1 text-sm text-ink-soft">
                NODE_ENV=production. Kiểm tra kỹ các cấu hình bên dưới trước khi mở cho người dùng thật.
                DATABASE_URL phải trỏ đến Neon PostgreSQL, không phải SQLite.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="surface rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Public beta</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Checklist trước khi mở beta</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
              Trang này kiểm tra các điều kiện vận hành cơ bản trước khi cho người học thật sử dụng: admin, nội dung published, diagnostic, backup, pháp lý và contest.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Người dùng", totalUsers],
          ["Published problems", publishedProblems],
          ["Diagnostic attempts", diagnosticAttempts],
          ["Content packs", contentPacks],
        ].map(([label, value]) => (
          <div key={label} className="surface rounded-2xl p-5">
            <CircleDashed className="size-5 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm text-ink-soft">{label}</p>
            <p className="tabular-nums mt-1 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {/* Deployment environment summary */}
      <section className="surface surface-muted rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Deployment environment</p>
        <div className="mt-3 grid gap-x-8 gap-y-2 text-sm md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Runtime", nodeEnv],
            ["APP URL", appUrl || "(chưa cấu hình)"],
            [
              "Database",
              process.env.DATABASE_URL
                ? process.env.DATABASE_URL.startsWith("file:")
                  ? "SQLite (local)"
                  : process.env.DATABASE_URL.replace(/\/\/[^@]+@/, "//***@")
                : "(chưa cấu hình)",
            ],
            ["SESSION_SECRET", hasRealSecret ? "Đã đặt ✓" : "Placeholder ⚠"],
            ["OWNER_EMAIL", ownerEmail || "(chưa cấu hình)"],
            ["DIRECT_URL", process.env.DIRECT_URL ? "Đã cấu hình ✓" : "(chưa cấu hình — chỉ cần cho migration)"],
          ].map(([label, value]) => (
            <div key={label as string}>
              <span className="font-semibold text-ink-soft">{label}: </span>
              <span className="break-all">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {checklist.map((item) => (
          <article key={item.label} className="surface rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{item.detail}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold text-ink-soft hover:text-foreground">
                    Mở mục liên quan
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Ghi chú vận hành</h2>
        </div>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-soft">
          <li>Luôn chạy <code>npm run db:backup</code> trước migration hoặc import lớn.</li>
          <li>Chạy <code>npm run db:export:portable</code> để export nội dung cho production migration.</li>
          <li>Không chạy seed trên database đã có dữ liệu người dùng/import thật.</li>
          <li>Không publish nội dung import trước khi QA và preview câu hỏi.</li>
          <li>Admin route và API phải tiếp tục chặn tài khoản learner thường.</li>
          <li>Production migration dùng <code>npm run prisma:deploy</code> hoặc Vercel build trigger.</li>
        </ul>
      </section>
    </div>
  );
}
