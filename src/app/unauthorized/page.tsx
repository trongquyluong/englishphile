import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-4 py-16">
      <section className="surface rounded-2xl p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50 text-danger">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">Bạn không có quyền truy cập khu vực này.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Khu vực quản trị chỉ dành cho người điều hành Englishphile. Nếu bạn đang học, hãy quay lại Gym hoặc dashboard cá nhân.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/gym" className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background">
            Vào Gym
          </Link>
          <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
            Về dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
