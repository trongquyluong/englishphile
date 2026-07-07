import Link from "next/link";
import { LogIn } from "lucide-react";
import { joinClassroomAction } from "@/app/teacher/actions";
import { requireUser } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function JoinClassPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <section className="surface rounded-lg p-6">
        <div className="flex items-center gap-2">
          <LogIn className="size-5 text-accent" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">Tham gia lớp học</h1>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Nhập mã tham gia do giáo viên cung cấp để xem bài được giao.</p>
        {message ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
        <form action={joinClassroomAction} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Mã tham gia
            <input name="joinCode" className="min-h-12 rounded-md border border-line bg-white px-3 font-mono text-lg uppercase tracking-[0.12em]" placeholder="ANH9A" />
          </label>
          <button className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Vào lớp</button>
        </form>
      </section>
      <Link href="/classes" className="text-sm font-semibold text-accent-strong">
        Xem lớp đã tham gia
      </Link>
    </div>
  );
}
