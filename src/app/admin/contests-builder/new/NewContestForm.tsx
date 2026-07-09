"use client";

import { useState } from "react";
import { createContestAction } from "@/app/admin/contests-builder/actions";

const durationOptions = [
  { value: "120", label: "120 phút" },
  { value: "150", label: "150 phút" },
  { value: "180", label: "180 phút" },
];

export function NewContestForm() {
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  return (
    <form action={createContestAction} className="grid gap-5">
      {/* Title */}
      <label className="grid gap-1.5 text-sm font-semibold">
        Tiêu đề
        <input name="title" required placeholder="VD: Đề thi HSG lớp 12 - Đợt 1" className="field" />
      </label>

      {/* Description */}
      <label className="grid gap-1.5 text-sm font-semibold">
        Mô tả
        <textarea name="description" rows={3} placeholder="Mô tả ngắn gọn nội dung contest..." className="field" />
      </label>

      {/* Time window */}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          Thời gian bắt đầu
          <input name="startsAt" type="datetime-local" className="field" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Thời gian kết thúc
          <input name="endsAt" type="datetime-local" className="field" />
        </label>
      </div>

      {/* Visibility */}
      <div className="grid gap-3">
        <p className="text-sm font-semibold">Chế độ hiển thị</p>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 rounded-xl bg-panel-muted px-4 py-3 cursor-pointer has-[:checked]:bg-accent-soft has-[:checked]:ring-2 has-[:checked]:ring-accent">
            <input
              type="radio"
              name="visibility"
              value="PUBLIC"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
              className="accent-[var(--accent)]"
            />
            <div>
              <p className="text-sm font-semibold">Công khai</p>
              <p className="text-xs text-ink-soft">Mọi người đều có thể tham gia</p>
            </div>
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-panel-muted px-4 py-3 cursor-pointer has-[:checked]:bg-accent-soft has-[:checked]:ring-2 has-[:checked]:ring-accent">
            <input
              type="radio"
              name="visibility"
              value="PRIVATE"
              checked={visibility === "PRIVATE"}
              onChange={() => setVisibility("PRIVATE")}
              className="accent-[var(--accent)]"
            />
            <div>
              <p className="text-sm font-semibold">Riêng tư</p>
              <p className="text-xs text-ink-soft">Cần mã truy cập để vào</p>
            </div>
          </label>
        </div>
      </div>

      {/* Access code (shown when private is selected) */}
      {visibility === "PRIVATE" && (
        <label className="grid gap-1.5 text-sm font-semibold">
          Mã truy cập
          <input name="accessCode" placeholder="VD: HSG2024" className="field" />
          <span className="font-normal text-ink-soft text-xs">Mã này cần được chia sẻ riêng với người tham gia</span>
        </label>
      )}

      {/* Duration */}
      <div className="grid gap-3">
        <p className="text-sm font-semibold">Thời lượng</p>
        <div className="flex gap-3">
          {durationOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-xl bg-panel-muted px-4 py-3 cursor-pointer has-[:checked]:bg-accent-soft has-[:checked]:ring-2 has-[:checked]:ring-accent"
            >
              <input
                type="radio"
                name="durationMinutes"
                value={option.value}
                defaultChecked={option.value === "120"}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm font-semibold">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn btn-primary">
          Tiếp tục tạo contest
        </button>
      </div>
    </form>
  );
}
