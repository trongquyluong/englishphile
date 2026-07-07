import { ImportCenter } from "@/components/admin/ImportCenter";
import { requireAdmin } from "@/lib/auth/session";
import { importTemplates } from "@/lib/import/templates";
import { prisma } from "@/lib/prisma";

export default async function AdminImportPage() {
  await requireAdmin();

  const history = await prisma.importBatch.findMany({
    include: {
      user: { select: { displayName: true } },
      sourceCollection: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Nhập dữ liệu</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Import center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Import JSON/CSV đã được chuẩn hóa từ nguồn nội dung của quản trị. Hệ thống chỉ lưu dữ liệu sau bước dry-run và
          không parse PDF/DOCX trực tiếp trong phase này.
        </p>
      </div>
      <ImportCenter
        templates={importTemplates}
        history={history.map((item) => ({
          id: item.id,
          createdAt: item.createdAt.toISOString(),
          userName: item.user.displayName,
          importType: item.importType,
          status: item.status,
          sourceName: item.sourceCollection?.name ?? null,
          summary: item.summary as Record<string, unknown>,
        }))}
      />
    </div>
  );
}
