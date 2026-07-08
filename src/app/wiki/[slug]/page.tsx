import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, Lightbulb, BookOpen } from "lucide-react";
import {
  formatWikiDate,
  getRelatedWikiArticles,
  getWikiArticle,
  wikiArticles,
  wikiCategoryLabels,
  type QuoteBlock,
  type TableBlock,
  type PracticeBlock,
  type AnswerKeyBlock,
  type StudyPlanBlock,
} from "@/lib/wiki-content";

// Quote block renderer
function QuoteBox({ quote }: { quote: QuoteBlock }) {
  const icons = {
    tip: Lightbulb,
    note: BookOpen,
    example: Check,
  };
  const labels = {
    tip: "Ghi nhớ nhanh",
    note: "Ví dụ",
    example: "Example",
  };
  const colors = {
    tip: "bg-accent-soft/70 text-accent-strong",
    note: "bg-panel-muted text-ink-soft",
    example: "bg-green-soft/70 text-green-strong",
  };
  const Icon = icons[quote.type];

  return (
    <div className={`mt-4 flex gap-2.5 rounded-2xl p-4 ${colors[quote.type]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm leading-6">
        {quote.type !== "note" ? (
          <span className="font-semibold">{labels[quote.type]}: </span>
        ) : null}
        {quote.content.split("\n\n").map((line, i) => (
          <p key={i} className={i > 0 || quote.type === "note" ? "mt-2" : ""}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// Table renderer with mobile-safe scrolling
function TableBox({ table }: { table: TableBlock }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-line bg-panel-muted">
            {table.headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-ink-soft">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Practice questions renderer
function PracticeBox({ practice }: { practice: PracticeBlock }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel-muted p-5">
      <h3 className="font-semibold">{practice.title}</h3>
      {practice.instruction ? (
        <p className="mt-1 text-sm text-ink-soft">{practice.instruction}</p>
      ) : null}
      <div className="mt-4 space-y-4">
        {practice.questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-[15px] leading-7">{q.question}</p>
            {q.options?.length ? (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt, oi) => (
                  <p key={oi} className="rounded-xl bg-panel px-3 py-2 text-sm">
                    {opt}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Answer key renderer
function AnswerKeyBox({ answerKey }: { answerKey: AnswerKeyBlock }) {
  return (
    <div className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/30 p-5">
      <h3 className="font-semibold text-accent-strong">{answerKey.title}</h3>
      <div className="mt-4 space-y-3">
        {answerKey.items.map((item, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-on-accent">
              {item.number}
            </span>
            <div>
              <p className="font-medium">{item.answer}</p>
              {item.explanation ? (
                <p className="mt-0.5 text-ink-soft">{item.explanation}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Study plan renderer
function StudyPlanBox({ studyPlan }: { studyPlan: StudyPlanBlock }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2">
        {studyPlan.days.map((day, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="flex h-6 min-w-[70px] shrink-0 items-center justify-center rounded-lg bg-accent px-2 text-xs font-semibold text-on-accent">
              {day.day}
            </span>
            <span className="text-ink-soft">{day.task}</span>
          </div>
        ))}
      </div>
      {studyPlan.trackingTable ? (
        <div className="mt-4 overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-line bg-panel-muted">
                {studyPlan.trackingTable.headers.map((header, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium text-ink-soft">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studyPlan.trackingTable.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-line last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {cell || <span className="text-ink-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return wikiArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getWikiArticle(slug);
  if (!article) return { title: "Wiki" };
  return { title: article.title, description: article.description };
}

export default async function WikiArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getWikiArticle(slug);
  if (!article) notFound();

  const relatedArticles = getRelatedWikiArticles(article.slug, 3);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/wiki"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Quay lại Wiki
      </Link>

      <article className="mt-2 grid gap-5">
        <header className="surface-mint rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
              {wikiCategoryLabels[article.category]}
            </span>
            {article.level ? (
              <span className="rounded-full bg-panel-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">{article.level}</span>
            ) : null}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{article.title}</h1>
          <p className="mt-3 text-base leading-7 text-ink-soft text-pretty">{article.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {article.readingTime} đọc
            </span>
            <span>Cập nhật {formatWikiDate(article.updatedAt)}</span>
          </div>
        </header>

        <div className="surface rounded-3xl p-6 md:p-8">
          <div className="grid gap-7">
            {article.sections.map((section, index) => (
              <section key={index}>
                {section.heading ? (
                  <h2 className="text-xl font-semibold tracking-tight text-balance">{section.heading}</h2>
                ) : null}
                {section.paragraphs?.map((paragraph, pi) => (
                  <p key={pi} className="mt-3 text-[15px] leading-7 text-ink-soft text-pretty">
                    {paragraph}
                  </p>
                ))}
                {section.items?.length ? (
                  <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-7 text-ink-soft marker:text-accent">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {section.items2?.length ? (
                  <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-7 text-ink-soft marker:text-accent">
                    {section.items2.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {section.paragraphs2?.map((paragraph, pi) => (
                  <p key={pi} className="mt-3 text-[15px] leading-7 text-ink-soft text-pretty">
                    {paragraph}
                  </p>
                ))}
                {section.quote ? <QuoteBox quote={section.quote} /> : null}
                {section.table ? <TableBox table={section.table} /> : null}
                {section.practice ? <PracticeBox practice={section.practice} /> : null}
                {section.answerKey ? <AnswerKeyBox answerKey={section.answerKey} /> : null}
                {section.studyPlan ? <StudyPlanBox studyPlan={section.studyPlan} /> : null}
                {section.tip ? (
                  <p className="mt-4 flex gap-2.5 rounded-2xl bg-accent-soft/70 p-4 text-sm leading-6 text-accent-strong">
                    <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">Mẹo: </span>
                      {section.tip}
                    </span>
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </article>

      {relatedArticles.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Đọc tiếp</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map((related) => (
              <Link key={related.slug} href={`/wiki/${related.slug}`} className="surface surface-hover flex flex-col rounded-3xl p-5">
                <p className="text-xs font-semibold text-accent">
                  {wikiCategoryLabels[related.category]}
                </p>
                <h3 className="mt-2 text-sm font-semibold leading-5 text-balance">{related.title}</h3>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-ink-soft">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {related.readingTime} đọc
                </span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong">
                  Đọc bài
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
