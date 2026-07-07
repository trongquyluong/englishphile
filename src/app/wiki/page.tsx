import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";
import {
  formatWikiDate,
  getWikiArticles,
  wikiCategoryLabels,
  wikiCategoryOrder,
  type WikiArticle,
  type WikiCategoryId,
} from "@/lib/wiki-content";

export const metadata: Metadata = {
  title: "Wiki",
  description: "Đọc nhanh cách làm dạng bài, lỗi thường gặp và chiến thuật luyện đề chuyên Anh.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type CategoryFilter = WikiCategoryId | "all";

function getCategoryFilter(value: unknown): CategoryFilter {
  return wikiCategoryOrder.some((id) => id === value) ? (value as WikiCategoryId) : "all";
}

function ArticleMeta({ article }: { article: WikiArticle }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-soft">
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden="true" />
        {article.readingTime} đọc
      </span>
      {article.level ? <span>{article.level}</span> : null}
      <span>Cập nhật {formatWikiDate(article.updatedAt)}</span>
    </div>
  );
}

function ArticleCard({ article }: { article: WikiArticle }) {
  return (
    <Link href={`/wiki/${article.slug}`} className="surface surface-hover flex flex-col rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">{wikiCategoryLabels[article.category]}</p>
      <h3 className="mt-2 font-semibold text-balance">{article.title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft text-pretty">{article.description}</p>
      <div className="mt-auto pt-4">
        <ArticleMeta article={article} />
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong">
        Đọc bài
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default async function WikiPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const activeCategory = getCategoryFilter(query.category);
  const articles = getWikiArticles();
  const availableCategories = wikiCategoryOrder.filter((id) => articles.some((article) => article.category === id));
  const filteredArticles = activeCategory === "all" ? articles : articles.filter((article) => article.category === activeCategory);
  const [featuredArticle, ...otherArticles] = activeCategory === "all" ? filteredArticles : [];
  const gridArticles = activeCategory === "all" ? otherArticles : filteredArticles;

  return (
    <div className="grid gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Wiki</p>
        <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-tight text-balance">Kiến thức và chiến thuật ôn tập</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">
          Đọc nhanh cách làm dạng bài, lỗi thường gặp và chiến thuật luyện đề.
        </p>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc bài viết theo chủ đề">
        <Link
          href="/wiki"
          aria-current={activeCategory === "all" ? "page" : undefined}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-[background-color,color] duration-150 ${
            activeCategory === "all" ? "bg-foreground text-background" : "bg-panel-muted text-ink-soft hover:text-foreground"
          }`}
        >
          Tất cả
        </Link>
        {availableCategories.map((categoryId) => (
          <Link
            key={categoryId}
            href={`/wiki?category=${categoryId}`}
            aria-current={activeCategory === categoryId ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-[background-color,color] duration-150 ${
              activeCategory === categoryId ? "bg-foreground text-background" : "bg-panel-muted text-ink-soft hover:text-foreground"
            }`}
          >
            {wikiCategoryLabels[categoryId]}
          </Link>
        ))}
      </nav>

      {featuredArticle ? (
        <section aria-label="Bài viết mới cập nhật">
          <Link href={`/wiki/${featuredArticle.slug}`} className="surface surface-hover flex flex-col rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">Mới cập nhật</span>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                {wikiCategoryLabels[featuredArticle.category]}
              </span>
            </div>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-balance">{featuredArticle.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft text-pretty">{featuredArticle.description}</p>
            <div className="mt-4">
              <ArticleMeta article={featuredArticle} />
            </div>
            <span className="mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
              Đọc bài
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </section>
      ) : null}

      {gridArticles.length ? (
        <section>
          <h2 className="text-lg font-semibold">
            {activeCategory === "all" ? "Tất cả bài viết" : `Bài viết ${wikiCategoryLabels[activeCategory]}`}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gridArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      ) : null}

      {!filteredArticles.length ? (
        <section className="surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Chưa có bài viết trong mục này</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Bài viết mới sẽ được thêm dần. Trong lúc chờ, bạn có thể luyện dạng bài tương ứng trong Gym.
          </p>
          <Link
            href="/gym"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
          >
            Vào Gym
          </Link>
        </section>
      ) : null}
    </div>
  );
}
