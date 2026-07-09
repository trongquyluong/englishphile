import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { NewContestForm } from "@/app/admin/contests-builder/new/NewContestForm";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContestBuilderPage({ searchParams }: PageProps) {
  await requireAdmin();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/contests-builder" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Quay lại
        </Link>
      </div>

      <div>
        <p className="text-sm font-semibold text-accent">Quản trị / Contest Builder</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tạo contest mới</h1>
        <p className="mt-2 text-sm text-ink-soft">Điền thông tin cơ bản, sau đó thêm phần thi và nhập câu hỏi ở bước tiếp theo.</p>
      </div>

      {error ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>
      ) : null}

      <section className="surface rounded-2xl p-5">
        <NewContestForm />
      </section>
    </div>
  );
}
