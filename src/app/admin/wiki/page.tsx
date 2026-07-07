import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function AdminWikiPage() {
  await requireAdmin();
  const notes = await prisma.theoryNote.findMany({ orderBy: { orderIndex: "asc" } });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">Quản trị</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Wiki</h1>
          <p className="mt-2 text-sm text-ink-soft">Trang quản trị nhẹ cho ghi chú hiện có. Editor đầy đủ có thể thêm sau.</p>
        </div>
        <Link href="/wiki" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-panel-muted px-3 text-sm font-semibold">
          <BookOpenText className="size-4" aria-hidden="true" />
          Xem Wiki
        </Link>
      </div>
      <section className="surface rounded-2xl p-5">
        <div className="grid gap-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl bg-white p-3 text-sm shadow-[var(--shadow-border)]">
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-xs text-ink-soft">{note.skillType ? skillLabels[note.skillType] : "General"}</p>
            </div>
          ))}
          {!notes.length ? <p className="rounded-xl bg-panel-muted p-4 text-sm text-ink-soft">Chưa có ghi chú Wiki.</p> : null}
        </div>
      </section>
    </div>
  );
}
