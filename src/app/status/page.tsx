import type { Metadata } from "next";
import { Activity, Database } from "lucide-react";
import { checkHealth } from "@/lib/health";

export const metadata: Metadata = {
  title: "Trạng thái hệ thống",
  description: "Theo dõi trạng thái beta của Englishphile.",
};

export default async function StatusPage() {
  const health = await checkHealth();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-sm font-semibold text-accent">Status</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Trạng thái Englishphile</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft text-pretty">
          Đây là trang trạng thái beta đơn giản. Nếu có lỗi lặp lại, hãy ghi lại thời điểm và gửi cho quản trị viên.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <Activity className="size-5 text-accent" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-soft">Ứng dụng</p>
          <p className="mt-1 text-xl font-semibold">{health.ok ? "Đang hoạt động" : "Cần kiểm tra"}</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <Database className="size-5 text-accent" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-soft">Database</p>
          <p className="mt-1 text-xl font-semibold">{health.database === "connected" ? "Đã kết nối" : "Mất kết nối"}</p>
        </article>
      </section>

      <section className="surface rounded-2xl p-5">
        <p className="text-sm text-ink-soft">Kiểm tra lần cuối</p>
        <p className="tabular-nums mt-2 font-semibold">{new Date(health.timestamp).toLocaleString("vi-VN")}</p>
        {health.version ? <p className="mt-2 text-sm text-ink-soft">Version: {health.version}</p> : null}
      </section>
    </div>
  );
}
