"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type ContestSubmitBarProps = {
  returnHref: string;
  startedAt: string;
  durationMinutes: number | null;
};

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ContestSubmitBar({ returnHref, startedAt, durationMinutes }: ContestSubmitBarProps) {
  const { pending } = useFormStatus();
  const startedAtMs = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!durationMinutes) return null;
    return Math.max(0, Math.ceil((startedAtMs + durationMinutes * 60 * 1000 - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!durationMinutes) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((startedAtMs + durationMinutes * 60 * 1000 - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [durationMinutes, startedAtMs]);

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-panel/95 p-3 shadow-[0_18px_60px_-32px_rgba(23,33,27,0.45)] backdrop-blur">
      <div className="mr-auto text-sm text-ink-soft">
        {remainingSeconds === null ? (
          "Không giới hạn thời gian"
        ) : (
          <>
            Còn lại <span className="tabular-nums font-semibold text-foreground">{formatSeconds(remainingSeconds)}</span>
          </>
        )}
      </div>
      <Link href={returnHref} className="inline-flex min-h-11 items-center rounded-lg bg-panel-muted px-4 text-sm font-semibold">
        Rời contest
      </Link>
      <button
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm("Bạn chắc chắn muốn nộp contest? Sau khi nộp, lượt làm này sẽ được chấm và lưu kết quả.")) {
            event.preventDefault();
          }
        }}
        className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Đang nộp..." : "Nộp contest"}
      </button>
    </div>
  );
}
