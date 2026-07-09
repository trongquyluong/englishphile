"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { ContestStatus, QuestionType, SkillType } from "@prisma/client";
import {
  createSectionAction,
  updateSectionAction,
  deleteSectionAction,
  createQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  updateContestMetaAction,
  publishContestAction,
  archiveContestAction,
  ValidationError,
} from "@/app/admin/contests-builder/actions";
import { contestStatusLabels, questionTypeLabels, skillLabels } from "@/lib/labels";

// --- Types ---

type ContestData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ContestStatus;
  durationMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

type SectionData = {
  id: string;
  title: string;
  skillType: SkillType;
  orderIndex: number;
  instructions: string | null;
  points: number | null;
  audioUrl: string | null;
  transcript: string | null;
  passageText: string | null;
  questions: QuestionData[];
};

type QuestionData = {
  id: string;
  orderIndex: number;
  type: QuestionType;
  prompt: string | null;
  optionsJson: unknown;
  answerJson: unknown;
  points: number | null;
  explanation: string | null;
  rootWord: string | null;
};

type Props = {
  contest: ContestData;
  sections: SectionData[];
  validationErrors: ValidationError[];
  flashMessage?: string;
  flashError?: string;
};

// --- Helpers ---

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const skillTypeOptions: SkillType[] = [
  "USE_OF_ENGLISH", "READING", "WRITING", "LISTENING",
  "PRONUNCIATION", "MULTIPLE_CHOICE", "OPEN_CLOZE", "GUIDED_CLOZE",
  "WORD_FORMATION", "SENTENCE_TRANSFORMATION", "ERROR_IDENTIFICATION",
  "TRIOS", "COLLOCATIONS", "PHRASAL_VERBS", "TRANSITIONS", "GRAMMAR_FOCUS",
];

const questionTypeOptions: QuestionType[] = [
  "MCQ", "SHORT_ANSWER", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE",
  "SENTENCE_TRANSFORMATION", "ERROR_IDENTIFICATION",
  "LISTENING_SHORT_ANSWER", "LISTENING_MCQ", "READING_MCQ",
  "WRITING_PROMPT", "TRIOS_GAPPED_SENTENCES", "PRONUNCIATION_ODD_ONE_OUT",
];

const statusOptions: ContestStatus[] = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"];

function needsOptions(type: QuestionType) {
  return ["MCQ", "GUIDED_CLOZE", "READING_MCQ", "LISTENING_MCQ"].includes(type);
}

function needsAnswerKey(type: QuestionType) {
  return [
    "MCQ", "SHORT_ANSWER", "WORD_FORMATION", "OPEN_CLOZE", "GUIDED_CLOZE",
    "LISTENING_SHORT_ANSWER", "LISTENING_MCQ", "READING_MCQ",
    "TRIOS_GAPPED_SENTENCES", "ERROR_IDENTIFICATION",
  ].includes(type);
}

function parseOptionsJson(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((o) => {
      if (typeof o === "object" && o !== null) {
        const obj = o as Record<string, unknown>;
        return `${obj.id ?? "A"}|${obj.text ?? ""}`;
      }
      return String(o);
    }).join("\n");
  }
  return "";
}

function parseAnswerJson(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const accepted = obj.acceptedAnswers ?? obj.accepted ?? obj.correctForm ?? obj.correctOptionId ?? "";
  if (Array.isArray(accepted)) return accepted.join(" / ");
  return String(accepted);
}

// --- Question Card ---

function QuestionCard({ contestId, question }: { contestId: string; question: QuestionData }) {
  const [open, setOpen] = useState(false);
  const hasOptions = needsOptions(question.type);
  const hasAnswer = needsAnswerKey(question.type);
  const optionsText = parseOptionsJson(question.optionsJson);
  const answerText = parseAnswerJson(question.answerJson);

  return (
    <div className="rounded-xl border border-line bg-panel-muted">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="size-3.5 text-ink-soft" /> : <ChevronRight className="size-3.5 text-ink-soft" />}
          <p className="text-sm font-semibold">
            {question.prompt ? question.prompt.slice(0, 60) + (question.prompt.length > 60 ? "…" : "") : "(chưa có nội dung)"}
          </p>
        </div>
        <span className="text-xs text-ink-soft">{questionTypeLabels[question.type]}</span>
      </button>

      {open && (
        <form action={updateQuestionAction} className="border-t border-line p-4 grid gap-3">
          <input type="hidden" name="questionId" value={question.id} />
          <input type="hidden" name="contestId" value={contestId} />
          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold">
              Loại
              <select name="type" defaultValue={question.type} className="field text-sm">
                {questionTypeOptions.map((t) => <option key={t} value={t}>{questionTypeLabels[t]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Thứ tự
              <input name="orderIndex" type="number" defaultValue={question.orderIndex} className="field text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Điểm
              <input name="points" type="number" step="0.5" defaultValue={question.points ?? 1} className="field text-sm" />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Nội dung
            <textarea name="prompt" defaultValue={question.prompt ?? ""} rows={3} className="field text-sm" />
          </label>
          {question.type === "WORD_FORMATION" && (
            <label className="grid gap-1 text-xs font-semibold">
              Root word
              <input name="rootWord" defaultValue={question.rootWord ?? ""} className="field text-sm" />
            </label>
          )}
          {hasOptions && (
            <label className="grid gap-1 text-xs font-semibold">
              Đáp án (mỗi dòng: <code className="text-accent">A|nội dung</code>)
              <textarea
                name="optionsJson"
                defaultValue={optionsText}
                rows={4}
                placeholder={"A|Đáp án A\nB|Đáp án B\nC|Đáp án C\nD|Đáp án D"}
                className="field text-sm font-mono"
              />
            </label>
          )}
          {hasAnswer && (
            <label className="grid gap-1 text-xs font-semibold">
              Đáp án đúng
              <input
                name="answerJson"
                defaultValue={answerText}
                placeholder={hasOptions ? "A" : "đáp án 1 / đáp án 2"}
                className="field text-sm"
              />
            </label>
          )}
          <label className="grid gap-1 text-xs font-semibold">
            Giải thích
            <textarea name="explanation" defaultValue={question.explanation ?? ""} rows={2} className="field text-sm" />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-sm btn-primary">Lưu</button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Xoá câu hỏi này?")) {
                  const fd = new FormData();
                  fd.set("questionId", question.id);
                  fd.set("contestId", contestId);
                  deleteQuestionAction(fd);
                }
              }}
              className="btn btn-sm btn-ghost text-danger hover:bg-danger-soft"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Xoá
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// --- Section Card ---

function SectionCard({ contestId, section, expanded }: { contestId: string; section: SectionData; expanded: boolean }) {
  const [open, setOpen] = useState(expanded);
  const [showAddQ, setShowAddQ] = useState(false);
  const isListening = section.skillType === "LISTENING";
  const isReading = section.skillType === "READING";

  return (
    <div className="rounded-2xl border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-panel-muted/50"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="size-4 text-ink-soft" /> : <ChevronRight className="size-4 text-ink-soft" />}
          <div>
            <p className="font-semibold">{section.title}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {skillLabels[section.skillType]} · {section.questions.length} câu
              {isListening && section.audioUrl ? " · 🎧 audio" : ""}
              {isReading && section.passageText ? " · 📖 passage" : ""}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-ink-soft">{skillLabels[section.skillType]}</span>
      </button>

      {open && (
        <div className="border-t border-line">
          {/* Section edit form */}
          <form action={updateSectionAction} className="grid gap-3 p-5">
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="contestId" value={contestId} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold">
                Tiêu đề section
                <input name="title" defaultValue={section.title} required className="field text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Skill type
                <select name="skillType" defaultValue={section.skillType} className="field text-sm">
                  {skillTypeOptions.map((s) => (
                    <option key={s} value={s}>{skillLabels[s]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Thứ tự
                <input name="orderIndex" type="number" defaultValue={section.orderIndex} className="field text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Điểm
                <input name="points" type="number" step="0.5" defaultValue={section.points ?? ""} placeholder="Tự động" className="field text-sm" />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-semibold">
              Hướng dẫn
              <textarea name="instructions" defaultValue={section.instructions ?? ""} rows={2} className="field text-sm" />
            </label>

            {isListening && (
              <>
                <label className="grid gap-1 text-xs font-semibold">
                  Đường dẫn audio
                  <input name="audioUrl" defaultValue={section.audioUrl ?? ""} placeholder="/audio/listening/test-01.mp3" className="field text-sm" />
                  <span className="font-normal text-ink-soft text-xs">
                    Tạm thời nhập đường dẫn audio, ví dụ /audio/listening/test-01.mp3. Upload file nghe sẽ được bổ sung ở phase sau.
                  </span>
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                  Transcript (chỉ admin)
                  <textarea name="transcript" defaultValue={section.transcript ?? ""} rows={4} className="field text-sm" />
                </label>
              </>
            )}

            {isReading && (
              <label className="grid gap-1 text-xs font-semibold">
                Passage (đoạn đọc)
                <textarea
                  name="passageText"
                  defaultValue={section.passageText ?? ""}
                  rows={6}
                  placeholder="Nhập đoạn văn cho phần Reading..."
                  className="field text-sm"
                />
              </label>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary">Lưu section</button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Xoá section "${section.title}" và tất cả câu hỏi?`)) {
                    const fd = new FormData();
                    fd.set("sectionId", section.id);
                    fd.set("contestId", contestId);
                    deleteSectionAction(fd);
                  }
                }}
                className="btn btn-sm btn-ghost text-danger hover:bg-danger-soft"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Xoá
              </button>
            </div>
          </form>

          {/* Questions */}
          <div className="border-t border-line">
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Câu hỏi ({section.questions.length})</p>
              <button
                type="button"
                onClick={() => setShowAddQ(!showAddQ)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Thêm câu hỏi
              </button>
            </div>

            {showAddQ && (
              <form action={createQuestionAction} className="mx-5 mb-3 grid gap-2 rounded-xl bg-panel-muted p-4">
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="contestId" value={contestId} />
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-1 text-xs font-semibold">
                    Loại câu hỏi
                    <select name="type" defaultValue="MCQ" className="field text-sm">
                      {questionTypeOptions.map((t) => (
                        <option key={t} value={t}>{questionTypeLabels[t]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Thứ tự
                    <input name="orderIndex" type="number" defaultValue={section.questions.length} className="field text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Điểm
                    <input name="points" type="number" step="0.5" defaultValue="1" className="field text-sm" />
                  </label>
                </div>
                <label className="grid gap-1 text-xs font-semibold">
                  Nội dung (prompt)
                  <input name="prompt" placeholder="Nhập câu hỏi..." className="field text-sm" />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">Thêm</button>
                  <button type="button" onClick={() => setShowAddQ(false)} className="btn btn-sm btn-ghost">Huỷ</button>
                </div>
              </form>
            )}

            <div className="px-5 pb-5 grid gap-3">
              {section.questions
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((q) => (
                  <QuestionCard key={q.id} contestId={contestId} question={q} />
                ))}
              {section.questions.length === 0 && !showAddQ && (
                <p className="rounded-xl bg-panel-muted p-4 text-center text-xs text-ink-soft">
                  Chưa có câu hỏi. Nhấn &quot;Thêm câu hỏi&quot; để bắt đầu.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Edit Component ---

export function ContestBuilderEdit({ contest, sections, validationErrors, flashMessage, flashError }: Props) {
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionSkillType, setSectionSkillType] = useState<SkillType>("USE_OF_ENGLISH");
  const canPublish = contest.status === "DRAFT" || contest.status === "SCHEDULED";
  const isPublished = contest.status === "LIVE";

  return (
    <div className="grid gap-5">
      {/* Flash messages */}
      {flashMessage ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{flashMessage}</p>
      ) : null}
      {flashError ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{flashError}</p>
      ) : null}
      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-sm font-semibold text-danger">Không thể xuất bản:</p>
          <ul className="mt-1 list-inside list-disc text-xs text-danger">
            {validationErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Contest metadata */}
      <section className="surface rounded-2xl p-5">
        <form action={updateContestMetaAction} className="grid gap-4">
          <input type="hidden" name="contestId" value={contest.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              Tiêu đề
              <input name="title" defaultValue={contest.title} required className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Slug
              <input name="slug" defaultValue={contest.slug} className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Trạng thái
              <select name="status" defaultValue={contest.status} className="field">
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{contestStatusLabels[s]}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Thời lượng (phút)
              <input name="durationMinutes" type="number" min={1} defaultValue={contest.durationMinutes ?? ""} className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Bắt đầu
              <input name="startsAt" type="datetime-local" defaultValue={toLocalDateTime(contest.startsAt)} className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Kết thúc
              <input name="endsAt" type="datetime-local" defaultValue={toLocalDateTime(contest.endsAt)} className="field" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Mô tả
            <textarea name="description" defaultValue={contest.description ?? ""} rows={2} className="field" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-primary">Lưu thông tin</button>
            {canPublish && (
              <form action={publishContestAction} className="inline">
                <input type="hidden" name="contestId" value={contest.id} />
                <button type="submit" className="btn btn-sm btn-primary">Xuất bản</button>
              </form>
            )}
            {isPublished && (
              <form action={archiveContestAction} className="inline">
                <input type="hidden" name="contestId" value={contest.id} />
                <button type="submit" className="btn btn-sm btn-ghost">Lưu trữ</button>
              </form>
            )}
            <Link href={`/contests/${contest.slug}/start?preview=1`} target="_blank" className="btn btn-sm btn-secondary">
              Xem trước
            </Link>
          </div>
        </form>
      </section>

      {/* Sections */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections ({sortedSections.length})</h2>
          <button
            type="button"
            onClick={() => setShowAddSection(!showAddSection)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background"
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm section
          </button>
        </div>

        {showAddSection && (
          <form action={createSectionAction} className="mb-4 grid gap-3 rounded-2xl border-2 border-dashed border-accent bg-accent-soft/20 p-5">
            <input type="hidden" name="contestId" value={contest.id} />
            <input type="hidden" name="orderIndex" value={sortedSections.length} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Tên section
                <input name="title" placeholder="VD: Use of English" required className="field text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Skill type
                <select
                  name="skillType"
                  value={sectionSkillType}
                  onChange={(e) => setSectionSkillType(e.target.value as SkillType)}
                  className="field text-sm"
                >
                  {skillTypeOptions.map((s) => (
                    <option key={s} value={s}>{skillLabels[s]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Hướng dẫn (tuỳ chọn)
              <input name="instructions" placeholder="VD: Đọc đoạn văn sau và trả lời các câu hỏi." className="field text-sm" />
            </label>
            {sectionSkillType === "LISTENING" && (
              <label className="grid gap-1 text-sm font-semibold">
                Đường dẫn audio
                <input name="audioUrl" placeholder="/audio/listening/test-01.mp3" className="field text-sm" />
                <span className="font-normal text-ink-soft text-xs">
                  Tạm thời nhập đường dẫn audio. Upload file sẽ được bổ sung ở phase sau.
                </span>
              </label>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary">Thêm section</button>
              <button type="button" onClick={() => setShowAddSection(false)} className="btn btn-sm btn-ghost">Huỷ</button>
            </div>
          </form>
        )}

        <div className="grid gap-3">
          {sortedSections.map((section) => (
            <SectionCard key={section.id} contestId={contest.id} section={section} expanded={sortedSections.length === 1} />
          ))}
          {sortedSections.length === 0 && !showAddSection && (
            <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
              <p className="text-sm text-ink-soft">Chưa có section nào. Nhấn &quot;Thêm section&quot; để bắt đầu.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
