"use client";

import { useMemo, useState } from "react";
import type { ContestStatus, ContestType, ContestVisibility, Difficulty, SkillType } from "@prisma/client";
import { DifficultyBadge, SkillBadge } from "@/components/ui/Badges";
import { contestStatusLabels, contestTypeLabels, contestVisibilityLabels, difficultyLabels, skillLabels } from "@/lib/labels";

type ContestFormProblem = {
  id: string;
  title: string;
  skillType: SkillType;
  difficulty: Difficulty;
  estimatedMinutes: number | null;
  sourceCollection: { name: string } | null;
  problemTopics: Array<{ topic: { name: string } }>;
};

type ContestFormContest = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  contestType: ContestType;
  status: ContestStatus;
  visibility: ContestVisibility;
  durationMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  sourceName: string | null;
  rules: string | null;
  problems: Array<{
    problemId: string;
    section: string;
    orderIndex: number;
    points: number | null;
  }>;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  problems: ContestFormProblem[];
  contest?: ContestFormContest;
  error?: string;
};

const sections = ["Pronunciation", "Use of English", "Reading", "Writing", "Listening"];
const contestTypes: ContestType[] = ["PAST_EXAM", "LIVE_CONTEST", "PRACTICE_CONTEST"];
const contestStatuses: ContestStatus[] = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"];
const contestVisibilities: ContestVisibility[] = ["PUBLIC", "PRIVATE", "UNLISTED"];
const skillTypes: SkillType[] = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "OPEN_CLOZE",
  "GUIDED_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "ERROR_IDENTIFICATION",
  "READING",
  "WRITING",
  "LISTENING",
  "TRIOS",
  "COLLOCATIONS",
  "PHRASAL_VERBS",
  "TRANSITIONS",
  "GRAMMAR_FOCUS",
];
const difficulties: Difficulty[] = ["B2", "C1", "C2", "CHUYEN", "HSG"];

function gymArea(skillType: SkillType) {
  if (skillType === "READING") return "Reading";
  if (skillType === "WRITING") return "Writing";
  if (skillType === "LISTENING") return "Listening";
  return "Use of English";
}

function fieldClass() {
  return "min-h-11 rounded-lg bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]";
}

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ContestForm({ action, problems, contest, error }: Props) {
  const selected = new Map((contest?.problems ?? []).map((item) => [item.problemId, item]));
  const [areaFilter, setAreaFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [search, setSearch] = useState("");
  const sourceOptions = useMemo(
    () => [...new Set(problems.map((problem) => problem.sourceCollection?.name).filter((value): value is string => Boolean(value)))].sort(),
    [problems],
  );
  const topicOptions = useMemo(
    () => [...new Set(problems.flatMap((problem) => problem.problemTopics.map((item) => item.topic.name)))].sort(),
    [problems],
  );
  const visibleProblems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return problems.filter((problem) => {
      const topics = problem.problemTopics.map((item) => item.topic.name);
      if (areaFilter && gymArea(problem.skillType) !== areaFilter) return false;
      if (skillFilter && problem.skillType !== skillFilter) return false;
      if (difficultyFilter && problem.difficulty !== difficultyFilter) return false;
      if (sourceFilter && problem.sourceCollection?.name !== sourceFilter) return false;
      if (topicFilter && !topics.includes(topicFilter)) return false;
      if (normalizedSearch && !problem.title.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [areaFilter, difficultyFilter, problems, search, skillFilter, sourceFilter, topicFilter]);
  const visibleProblemIds = new Set(visibleProblems.map((problem) => problem.id));

  return (
    <form action={action} className="grid gap-6">
      {contest ? <input type="hidden" name="contestId" value={contest.id} /> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Thông tin contest</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Tiêu đề
            <input name="title" required defaultValue={contest?.title ?? ""} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Slug
            <input name="slug" defaultValue={contest?.slug ?? ""} className={fieldClass()} placeholder="Tự tạo nếu để trống" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold md:col-span-2">
            Mô tả
            <textarea name="description" defaultValue={contest?.description ?? ""} className="min-h-24 rounded-lg bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Loại contest
            <select name="contestType" defaultValue={contest?.contestType ?? "PRACTICE_CONTEST"} className={fieldClass()}>
              {contestTypes.map((type) => <option key={type} value={type}>{contestTypeLabels[type]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Trạng thái
            <select name="status" defaultValue={contest?.status ?? "DRAFT"} className={fieldClass()}>
              {contestStatuses.map((status) => <option key={status} value={status}>{contestStatusLabels[status]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Visibility
            <select name="visibility" defaultValue={contest?.visibility ?? "PUBLIC"} className={fieldClass()}>
              {contestVisibilities.map((visibility) => <option key={visibility} value={visibility}>{contestVisibilityLabels[visibility]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Thời lượng phút
            <input name="durationMinutes" type="number" min={0} defaultValue={contest?.durationMinutes ?? ""} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Bắt đầu
            <input name="startsAt" type="datetime-local" defaultValue={toLocalDateTime(contest?.startsAt)} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Kết thúc
            <input name="endsAt" type="datetime-local" defaultValue={toLocalDateTime(contest?.endsAt)} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Nguồn đề
            <input name="sourceName" defaultValue={contest?.sourceName ?? ""} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold md:col-span-2">
            Luật / ghi chú
            <textarea name="rules" defaultValue={contest?.rules ?? ""} className="min-h-24 rounded-lg bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]" />
          </label>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Chọn problem đã xuất bản</h2>
        <p className="mt-1 text-sm text-ink-soft">Contest chỉ dùng nội dung đã publish. Bộ lọc giúp chọn đúng section trước khi publish hoặc lên lịch.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-6">
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Gym area
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className={fieldClass()}>
              <option value="">Tất cả</option>
              {sections.map((section) => <option key={section} value={section}>{section}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Skill
            <select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} className={fieldClass()}>
              <option value="">Tất cả</option>
              {skillTypes.map((skill) => <option key={skill} value={skill}>{skillLabels[skill]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Difficulty
            <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} className={fieldClass()}>
              <option value="">Tất cả</option>
              {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficultyLabels[difficulty]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Source
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className={fieldClass()}>
              <option value="">Tất cả</option>
              {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Topic
            <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className={fieldClass()}>
              <option value="">Tất cả</option>
              {topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass()} placeholder="Tên problem" />
          </label>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Đang hiển thị <span className="tabular-nums font-semibold text-foreground">{visibleProblems.length}</span>/<span className="tabular-nums">{problems.length}</span> problem đã publish.
        </p>
        <div className="mt-4 grid gap-2">
          {visibleProblems.map((problem, index) => {
            const current = selected.get(problem.id);
            const topics = problem.problemTopics.map((item) => item.topic.name).slice(0, 2);
            return (
              <div key={problem.id} className="grid gap-3 rounded-xl bg-white p-3 text-sm shadow-[var(--shadow-border)] lg:grid-cols-[32px_minmax(240px,1fr)_130px_150px_90px_90px] lg:items-center">
                <input type="checkbox" name="problemId" value={problem.id} defaultChecked={Boolean(current)} className="size-4 accent-[var(--accent)]" />
                <div>
                  <p className="font-semibold">{problem.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {problem.estimatedMinutes ? `${problem.estimatedMinutes} phút` : "Chưa có estimated time"}
                    {problem.sourceCollection?.name ? ` · ${problem.sourceCollection.name}` : ""}
                    {topics.length ? ` · ${topics.join(", ")}` : ""}
                  </p>
                </div>
                <SkillBadge skill={problem.skillType} />
                <select name={`section_${problem.id}`} defaultValue={current?.section ?? (problem.skillType === "READING" ? "Reading" : problem.skillType === "WRITING" ? "Writing" : problem.skillType === "LISTENING" ? "Listening" : "Use of English")} className={fieldClass()}>
                  {sections.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
                <input name={`order_${problem.id}`} type="number" defaultValue={current?.orderIndex ?? index} className={fieldClass()} />
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
            );
          })}
          {(contest?.problems ?? [])
            .filter((item) => !visibleProblemIds.has(item.problemId))
            .map((item) => (
              <div key={`hidden-${item.problemId}`} hidden>
                <input type="hidden" name="problemId" value={item.problemId} />
                <input type="hidden" name={`section_${item.problemId}`} value={item.section} />
                <input type="hidden" name={`order_${item.problemId}`} value={item.orderIndex} />
                {item.points !== null && item.points !== undefined ? <input type="hidden" name={`points_${item.problemId}`} value={item.points} /> : null}
              </div>
            ))}
        </div>
      </section>

      <button className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96]">
        {contest ? "Lưu contest" : "Tạo contest"}
      </button>
    </form>
  );
}
