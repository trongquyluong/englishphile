import Link from "next/link";
import type { Metadata } from "next";
import { BookOpenText, Goal, Headphones, PenTool, ScrollText, Search } from "lucide-react";
import { skillLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Wiki",
  description: "Wiki Englishphile lưu ghi chú kiến thức, chiến thuật và định hướng luyện tập.",
};

const categories = [
  { title: "Use of English", icon: ScrollText, description: "Grammar, cloze, word formation, transformation." },
  { title: "Reading", icon: BookOpenText, description: "Inference, tone, purpose, vocabulary in context." },
  { title: "Writing", icon: PenTool, description: "Planning, paragraphing, argument and register." },
  { title: "Listening", icon: Headphones, description: "Transcript, audio sections and note-taking." },
  { title: "Exam Strategy", icon: Goal, description: "Cách phân bổ thời gian và review lỗi sau khi làm bài." },
];

export default async function WikiPage() {
  const notes = await prisma.theoryNote.findMany({
    orderBy: { orderIndex: "asc" },
    include: { topic: true },
  });

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Wiki</p>
        <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-tight text-balance">Kiến thức và chiến thuật ôn tập</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
          Wiki là nơi lưu ghi chú nền tảng, cách làm dạng bài và chiến thuật thi. Nội dung sẽ được mở rộng dần bởi quản trị viên.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <article key={category.title} className="surface rounded-2xl p-4">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">{category.title}</h2>
              <p className="mt-2 text-xs leading-5 text-ink-soft text-pretty">{category.description}</p>
            </article>
          );
        })}
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Search className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Ghi chú hiện có</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {notes.length ? (
            notes.map((note) => (
              <details key={note.id} className="rounded-xl bg-white p-4 shadow-[var(--shadow-border)]">
                <summary className="cursor-pointer list-none">
                  <h3 className="font-semibold">{note.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                    {note.skillType ? skillLabels[note.skillType] : "General"}
                  </p>
                </summary>
                <p className="mt-4 text-sm leading-7 text-ink-soft">{note.content}</p>
              </details>
            ))
          ) : (
            <div className="rounded-xl bg-panel-muted p-5 md:col-span-2">
              <h3 className="font-semibold">Wiki chưa có bài viết</h3>
              <p className="mt-2 text-sm text-ink-soft">Quản trị viên có thể thêm nội dung sau. Học viên vẫn có thể vào Gym và làm diagnostic.</p>
            </div>
          )}
        </div>
        <div className="mt-5">
          <Link href="/gym" className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-3 text-sm font-semibold text-background">
            Vào Gym
          </Link>
        </div>
      </section>
    </div>
  );
}
