"use client";

import type { AssignmentType, Difficulty, SkillType } from "@prisma/client";
import { ArrowDown, ArrowUp, Clock, Layers3, Search, Wand2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DifficultyBadge, SkillBadge, SourceBadge, TopicTag } from "@/components/ui/Badges";
import { assignmentTypeLabels, difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import { cn } from "@/lib/utils";

type BuilderClassroom = {
  id: string;
  name: string;
};

type BuilderProblem = {
  id: string;
  title: string;
  skillType: SkillType;
  difficulty: Difficulty;
  estimatedMinutes: number | null;
  sourceCollection: { id: string; name: string } | null;
  problemTopics: Array<{ topic: { id: string; name: string; slug: string } }>;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  classrooms: BuilderClassroom[];
  problems: BuilderProblem[];
  defaultClassroomId?: string;
  error?: string;
  message?: string;
};

const assignmentTypes: AssignmentType[] = ["PRACTICE_SET", "MOCK_TEST", "HOMEWORK", "REVIEW_SET"];
const presetCounts: Record<string, Partial<Record<SkillType, number>>> = {
  "Mock cá nhân hóa 45 phút": {
    PRONUNCIATION: 1,
    MULTIPLE_CHOICE: 2,
    GUIDED_CLOZE: 1,
    OPEN_CLOZE: 1,
    WORD_FORMATION: 1,
    SENTENCE_TRANSFORMATION: 1,
    READING: 1,
    WRITING: 1,
  },
  "Use of English intensive": {
    MULTIPLE_CHOICE: 3,
    GUIDED_CLOZE: 1,
    OPEN_CLOZE: 1,
    WORD_FORMATION: 2,
    SENTENCE_TRANSFORMATION: 2,
  },
  "Word formation + transformation": {
    WORD_FORMATION: 3,
    SENTENCE_TRANSFORMATION: 3,
  },
  "Reading + writing": {
    READING: 2,
    WRITING: 1,
    TRANSITIONS: 1,
  },
};

const mockSkills: SkillType[] = [
  "PRONUNCIATION",
  "MULTIPLE_CHOICE",
  "GUIDED_CLOZE",
  "OPEN_CLOZE",
  "WORD_FORMATION",
  "SENTENCE_TRANSFORMATION",
  "READING",
  "WRITING",
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function AssignmentBuilder({ action, classrooms, problems, defaultClassroomId, error, message }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [counts, setCounts] = useState<Partial<Record<SkillType, number>>>({});
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("HOMEWORK");

  const topics = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string }>();
    problems.forEach((problem) => problem.problemTopics.forEach(({ topic }) => map.set(topic.slug, topic)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [problems]);

  const sources = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    problems.forEach((problem) => {
      if (problem.sourceCollection) map.set(problem.sourceCollection.id, problem.sourceCollection);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [problems]);

  const selectedProblems = selectedIds
    .map((id) => problems.find((problem) => problem.id === id))
    .filter((problem): problem is BuilderProblem => Boolean(problem));

  const filteredProblems = problems.filter((problem) => {
    const normalized = query.trim().toLowerCase();
    return (
      (!normalized || problem.title.toLowerCase().includes(normalized)) &&
      (!skill || problem.skillType === skill) &&
      (!difficulty || problem.difficulty === difficulty) &&
      (!source || problem.sourceCollection?.id === source) &&
      (!topic || problem.problemTopics.some(({ topic: item }) => item.slug === topic))
    );
  });

  const totalMinutes = selectedProblems.reduce((sum, problem) => sum + (problem.estimatedMinutes ?? 0), 0);
  const selectedBySkill = selectedProblems.reduce<Record<string, number>>((summary, problem) => {
    summary[problem.skillType] = (summary[problem.skillType] ?? 0) + 1;
    return summary;
  }, {});

  const toggleProblem = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const moveProblem = (id: string, direction: -1 | 1) => {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applyPreset = (name: string) => {
    setAssignmentType("MOCK_TEST");
    setCounts(presetCounts[name] ?? {});
  };

  const autoSelect = () => {
    const picked: string[] = [];
    mockSkills.forEach((itemSkill) => {
      const count = counts[itemSkill] ?? 0;
      if (count <= 0) return;
      const candidates = shuffle(
        problems.filter((problem) => problem.skillType === itemSkill && (!difficulty || problem.difficulty === difficulty)),
      ).slice(0, count);
      candidates.forEach((problem) => {
        if (!picked.includes(problem.id)) picked.push(problem.id);
      });
    });
    setSelectedIds(picked);
  };

  return (
    <form action={action} className="grid gap-6">
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</div> : null}
      {message ? <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</div> : null}

      <section className="surface rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Layers3 className="size-5 text-accent" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Thông tin bài giao</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Tiêu đề
            <input name="title" className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal" required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Lớp học
            <select name="classroomId" defaultValue={defaultClassroomId ?? ""} className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal">
              <option value="">Không gắn lớp</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold md:col-span-2">
            Mô tả
            <textarea name="description" className="min-h-24 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Loại bài
            <select
              name="assignmentType"
              value={assignmentType}
              onChange={(event) => setAssignmentType(event.target.value as AssignmentType)}
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal"
            >
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {assignmentTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Hạn nộp
            <input name="dueAt" type="datetime-local" className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Giới hạn thời gian (phút)
            <input name="timeLimitMinutes" type="number" min={0} className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-normal" />
          </label>
          <div className="grid gap-2 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input name="allowLateSubmission" type="checkbox" defaultChecked className="size-4 accent-foreground" />
              Cho phép nộp muộn
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input name="showAnswersAfterSubmit" type="checkbox" defaultChecked className="size-4 accent-foreground" />
              Hiện đáp án sau khi nộp
            </label>
          </div>
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tạo theo cấu trúc đề</h2>
            <p className="mt-1 text-sm text-ink-soft">Chọn preset hoặc nhập số lượng theo skill, sau đó hệ thống tự chọn problem đã xuất bản.</p>
          </div>
          <button
            type="button"
            onClick={autoSelect}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background"
          >
            <Wand2 className="size-4" aria-hidden="true" />
            Tự chọn câu phù hợp
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.keys(presetCounts).map((preset) => (
            <button key={preset} type="button" onClick={() => applyPreset(preset)} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold hover:bg-accent-soft">
              {preset}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mockSkills.map((itemSkill) => (
            <label key={itemSkill} className="grid gap-1 text-sm font-semibold">
              {skillLabels[itemSkill]}
              <input
                type="number"
                min={0}
                value={counts[itemSkill] ?? ""}
                onChange={(event) => setCounts((current) => ({ ...current, [itemSkill]: Number(event.target.value) || 0 }))}
                className="min-h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface rounded-lg p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Chọn problem</h2>
              <p className="mt-1 text-sm text-ink-soft">Chỉ hiển thị problem đã xuất bản để tránh giao nhầm bản nháp.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm problem" className="min-h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm lg:w-64" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={skill} onChange={(event) => setSkill(event.target.value)} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Tất cả skill</option>
              {skillOrder.map((item) => (
                <option key={item} value={item}>
                  {skillLabels[item]}
                </option>
              ))}
            </select>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Tất cả độ khó</option>
              {difficultyOrder.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={topic} onChange={(event) => setTopic(event.target.value)} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Tất cả topic</option>
              {topics.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="min-h-10 rounded-md border border-line bg-white px-3 text-sm">
              <option value="">Tất cả nguồn</option>
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[44px_minmax(220px,1fr)_130px_90px] bg-panel-muted px-3 py-2 text-xs font-semibold uppercase text-ink-soft">
              <span />
              <span>Problem</span>
              <span>Skill</span>
              <span>Độ khó</span>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {filteredProblems.map((problem) => {
                const selected = selectedIds.includes(problem.id);
                return (
                  <label
                    key={problem.id}
                    className={cn(
                      "grid cursor-pointer grid-cols-[44px_minmax(220px,1fr)_130px_90px] items-center gap-2 border-t border-line px-3 py-3 text-sm",
                      selected ? "bg-accent-soft" : "bg-white hover:bg-panel-muted",
                    )}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleProblem(problem.id)} className="size-4 accent-foreground" />
                    <span className="grid gap-1">
                      <span className="font-semibold">{problem.title}</span>
                      <span className="flex flex-wrap gap-1">
                        {problem.problemTopics.slice(0, 2).map(({ topic }) => (
                          <TopicTag key={topic.id} name={topic.name} />
                        ))}
                        {problem.sourceCollection ? <SourceBadge name={problem.sourceCollection.name} /> : null}
                      </span>
                    </span>
                    <SkillBadge skill={problem.skillType} />
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="surface h-fit rounded-lg p-5 xl:sticky xl:top-24">
          <h2 className="text-lg font-semibold">Problem đã chọn</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {selectedProblems.length} problem · <Clock className="inline size-3 align-[-1px]" aria-hidden="true" /> {totalMinutes || "—"} phút
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(selectedBySkill).map(([itemSkill, count]) => (
              <span key={itemSkill} className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold">
                {skillLabels[itemSkill as SkillType]}: {count}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {selectedProblems.length ? (
              selectedProblems.map((problem, index) => (
                <div key={problem.id} className="rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                  <input type="hidden" name="problemId" value={problem.id} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-ink-soft">#{index + 1}</p>
                      <p className="text-sm font-semibold">{problem.title}</p>
                    </div>
                    <button type="button" onClick={() => toggleProblem(problem.id)} className="rounded p-1 text-ink-soft hover:bg-panel-muted">
                      <X className="size-4" aria-hidden="true" />
                      <span className="sr-only">Bỏ chọn</span>
                    </button>
                  </div>
                  <div className="mt-3 flex gap-1">
                    <button type="button" onClick={() => moveProblem(problem.id, -1)} className="rounded bg-panel-muted p-1">
                      <ArrowUp className="size-4" aria-hidden="true" />
                      <span className="sr-only">Đưa lên</span>
                    </button>
                    <button type="button" onClick={() => moveProblem(problem.id, 1)} className="rounded bg-panel-muted p-1">
                      <ArrowDown className="size-4" aria-hidden="true" />
                      <span className="sr-only">Đưa xuống</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-panel-muted p-4 text-sm text-ink-soft">Chưa chọn problem nào.</p>
            )}
          </div>
          <div className="mt-5 grid gap-2">
            <button name="status" value="PUBLISHED" className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Xuất bản bài giao
            </button>
            <button name="status" value="DRAFT" className="min-h-11 rounded-md bg-panel-muted px-4 text-sm font-semibold">
              Lưu bản nháp
            </button>
          </div>
        </aside>
      </section>
    </form>
  );
}
