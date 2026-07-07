import type { SourceCollection, Topic } from "@prisma/client";
import { Search } from "lucide-react";
import { difficultyLabels, difficultyOrder, problemStatusLabels, skillLabels, skillOrder } from "@/lib/labels";

type ProblemFiltersProps = {
  topics: Pick<Topic, "id" | "name" | "slug">[];
  sources: Pick<SourceCollection, "id" | "name">[];
  values: Record<string, string | undefined>;
  showContentToggle?: boolean;
};

export function ProblemFilters({ topics, sources, values, showContentToggle = false }: ProblemFiltersProps) {
  return (
    <form className="surface grid gap-3 rounded-lg p-4 lg:sticky lg:top-24" action="/problems">
      <label className="grid gap-1.5 text-sm font-medium">
        Tìm kiếm
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            name="q"
            defaultValue={values.q}
            placeholder="Tên bài, dạng bài..."
            className="min-h-10 w-full rounded-md bg-white pl-9 pr-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2"
          />
        </div>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Chế độ luyện
        <select
          name="mode"
          defaultValue={values.mode ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          <option value="reading">Reading</option>
          <option value="writing">Writing</option>
          <option value="listening">Listening</option>
          <option value="use-of-english">Use of English</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Gợi ý cá nhân
        <select
          name="personalized"
          defaultValue={values.personalized ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Không áp dụng</option>
          <option value="level">Phù hợp với trình độ của tôi</option>
          <option value="weak-skill">Dạng bài yếu</option>
          <option value="weak-topic">Topic yếu</option>
          <option value="not-attempted">Chưa làm</option>
          <option value="wrong">Đã sai</option>
          <option value="challenge">Thử thách</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Kỹ năng
        <select
          name="skill"
          defaultValue={values.skill ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          {skillOrder.map((skill) => (
            <option key={skill} value={skill}>
              {skillLabels[skill]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Độ khó
        <select
          name="difficulty"
          defaultValue={values.difficulty ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          {difficultyOrder.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficultyLabels[difficulty]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Topic
        <select
          name="topic"
          defaultValue={values.topic ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Trạng thái luyện tập
        <select
          name="status"
          defaultValue={values.status ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          {Object.entries(problemStatusLabels).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {showContentToggle ? (
        <label className="flex min-h-10 items-start gap-2 rounded-md bg-panel-muted px-3 py-2 text-sm font-medium">
          <input
            type="checkbox"
            name="includeDrafts"
            value="1"
            defaultChecked={values.includeDrafts === "1"}
            className="mt-1 accent-[var(--accent)]"
          />
          <span>
            Hiện cả bản nháp / cần duyệt
            <span className="block text-xs font-normal text-ink-soft">Chỉ quản trị viên thấy tùy chọn này.</span>
          </span>
        </label>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium">
        Nguồn
        <select
          name="source"
          defaultValue={values.source ?? ""}
          className="min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]"
        >
          <option value="">Tất cả</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        Lọc bài
      </button>
    </form>
  );
}
