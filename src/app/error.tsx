"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <section className="surface rounded-2xl p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">Có lỗi khi tải trang.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Hãy thử tải lại. Nếu lỗi lặp lại, ghi lại thời điểm xảy ra lỗi để quản trị viên kiểm tra.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-ink-soft">Mã lỗi: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
            Tải lại
          </button>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
            Về dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
