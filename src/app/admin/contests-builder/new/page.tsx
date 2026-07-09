import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createContestAction } from "@/app/admin/contests-builder/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewContestBuilderPage({ searchParams }: PageProps) {
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
      </div>

      {error ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>
      ) : null}

      <section className="surface rounded-2xl p-5">
        <form action={createContestAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              Tiêu đề
              <input name="title" required placeholder="VD: Đề thi HSG lớp 12 - Đợt 1" className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Slug
              <input name="slug" placeholder="Tự tạo nếu để trống" className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Thời lượng (phút)
              <input name="durationMinutes" type="number" min={1} placeholder="VD: 90" className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Trạng thái ban đầu
              <select name="status" defaultValue="DRAFT" className="field">
                <option value="DRAFT">Bản nháp</option>
                <option value="LIVE">Đang mở</option>
                <option value="SCHEDULED">Lên lịch</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Bắt đầu lúc
              <input name="startsAt" type="datetime-local" className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Kết thúc lúc
              <input name="endsAt" type="datetime-local" className="field" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Mô tả
            <textarea name="description" rows={3} placeholder="Mô tả ngắn gọn nội dung contest..." className="field" />
          </label>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary">
              Tạo contest
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
