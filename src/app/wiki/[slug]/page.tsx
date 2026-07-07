import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lightbulb } from "lucide-react";
import {
  formatWikiDate,
  getRelatedWikiArticles,
  getWikiArticle,
  wikiArticles,
  wikiCategoryLabels,
} from "@/lib/wiki-content";

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
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-[15px] leading-7 text-ink-soft text-pretty">
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
