"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Trash2, Eye, Save, Send } from "lucide-react";
import type { ContestStatus, ContestVisibility, QuestionType, SkillType } from "@prisma/client";
import {
  createSectionWithQuestionsAction,
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
import { skillLabels, questionTypeLabels, contestStatusLabels } from "@/lib/labels";

// --- Types ---

type ContestData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ContestStatus;
  visibility: ContestVisibility;
  accessCode: string | null;
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

const durationOptions = [
  { value: 120, label: "120 phút" },
  { value: 150, label: "150 phút" },
  { value: 180, label: "180 phút" },
];

// Exam section types for the builder
type ExamSectionType = "USE_OF_ENGLISH_MCQ" | "WORD_FORMATION" | "OPEN_CLOZE" | "GUIDED_CLOZE" | "READING" | "LISTENING" | "WRITING";

interface ExamSectionConfig {
  id: ExamSectionType;
  label: string;
  skillType: SkillType;
  questionType: QuestionType;
  hasPassage: boolean;
  hasAudio: boolean;
  hasRootWord: boolean;
}

const EXAM_SECTION_TYPES: ExamSectionConfig[] = [
  { id: "USE_OF_ENGLISH_MCQ", label: "Use of English — Multiple Choice", skillType: "USE_OF_ENGLISH", questionType: "MCQ", hasPassage: false, hasAudio: false, hasRootWord: false },
  { id: "WORD_FORMATION", label: "Use of English — Word Formation", skillType: "WORD_FORMATION", questionType: "WORD_FORMATION", hasPassage: false, hasAudio: false, hasRootWord: true },
  { id: "OPEN_CLOZE", label: "Use of English — Open Cloze", skillType: "OPEN_CLOZE", questionType: "OPEN_CLOZE", hasPassage: false, hasAudio: false, hasRootWord: false },
  { id: "GUIDED_CLOZE", label: "Use of English — Guided Cloze", skillType: "GUIDED_CLOZE", questionType: "GUIDED_CLOZE", hasPassage: false, hasAudio: false, hasRootWord: false },
  { id: "READING", label: "Reading", skillType: "READING", questionType: "READING_MCQ", hasPassage: true, hasAudio: false, hasRootWord: false },
  { id: "LISTENING", label: "Listening", skillType: "LISTENING", questionType: "LISTENING_MCQ", hasPassage: false, hasAudio: true, hasRootWord: false },
  { id: "WRITING", label: "Writing", skillType: "WRITING", questionType: "WRITING_PROMPT", hasPassage: false, hasAudio: false, hasRootWord: false },
];

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

function QuestionCard({ contestId, question, sectionType }: { contestId: string; question: QuestionData; sectionType: ExamSectionType }) {
  const [open, setOpen] = useState(false);
  const hasOptions = needsOptions(question.type);
  const hasAnswer = needsAnswerKey(question.type);
  const sectionConfig = EXAM_SECTION_TYPES.find((s) => s.id === sectionType);
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
            Câu {question.orderIndex + 1}: {question.prompt ? question.prompt.slice(0, 50) + (question.prompt.length > 50 ? "…" : "") : "(chưa có nội dung)"}
          </p>
        </div>
        <span className="text-xs text-ink-soft">{questionTypeLabels[question.type]}</span>
      </button>

      {open && (
        <form action={updateQuestionAction} className="border-t border-line p-4 grid gap-3">
          <input type="hidden" name="questionId" value={question.id} />
          <input type="hidden" name="contestId" value={contestId} />
          <input type="hidden" name="type" value={question.type} />
          <div className="grid gap-2 md:grid-cols-3">
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
            Nội dung câu hỏi
            <textarea name="prompt" defaultValue={question.prompt ?? ""} rows={2} className="field text-sm" />
          </label>
          {sectionConfig?.hasRootWord && (
            <label className="grid gap-1 text-xs font-semibold">
              Từ gốc (root word)
              <input name="rootWord" defaultValue={question.rootWord ?? ""} placeholder="VD: develop" className="field text-sm" />
            </label>
          )}
          {hasOptions && (
            <label className="grid gap-1 text-xs font-semibold">
              Lựa chọn (mỗi dòng: <code className="text-accent">A|nội dung</code>)
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
              {!hasOptions && (
                <span className="font-normal text-ink-soft">Nhiều đáp án chấp nhận được thì phân tách bằng dấu &quot;/&quot;.</span>
              )}
            </label>
          )}
          <label className="grid gap-1 text-xs font-semibold">
            Giải thích (tuỳ chọn)
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

function SectionCard({ contestId, section }: { contestId: string; section: SectionData }) {
  const [open, setOpen] = useState(false);
  const [showAddQ, setShowAddQ] = useState(false);
  const isListening = section.skillType === "LISTENING";
  const isReading = section.skillType === "READING";
  const sectionConfig = EXAM_SECTION_TYPES.find((s) => s.skillType === section.skillType);

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
              {skillLabels[section.skillType]} · {section.questions.length} câu · {section.points ?? 0} điểm
              {isListening && section.audioUrl ? " · 🎧 audio" : ""}
              {isReading && section.passageText ? " · 📖 passage" : ""}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-ink-soft">{section.points ? `${section.points} điểm` : ""}</span>
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
                Tổng điểm
                <input name="points" type="number" step="0.5" defaultValue={section.points ?? ""} placeholder="VD: 20" className="field text-sm" />
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
                    Tạm thời nhập đường dẫn audio, ví dụ /audio/listening/test-01.mp3. Upload file nghe sẽ được bổ sung sau.
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
                <input type="hidden" name="type" value={sectionConfig?.questionType ?? "MCQ"} />
                <input type="hidden" name="orderIndex" value={section.questions.length} />
                <label className="grid gap-1 text-xs font-semibold">
                  Nội dung câu hỏi
                  <input name="prompt" placeholder="Nhập câu hỏi..." className="field text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold">
                  Điểm
                  <input name="points" type="number" step="0.5" defaultValue="1" className="field text-sm" />
                </label>
                {sectionConfig?.hasRootWord && (
                  <label className="grid gap-1 text-xs font-semibold">
                    Từ gốc (root word)
                    <input name="rootWord" placeholder="VD: develop" className="field text-sm" />
                  </label>
                )}
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
                  <QuestionCard key={q.id} contestId={contestId} question={q} sectionType={sectionConfig?.id ?? "USE_OF_ENGLISH_MCQ"} />
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

// --- Exam Builder: Add Section Modal ---

function AddSectionModal({
  contestId,
  nextOrderIndex,
  onClose,
}: {
  contestId: string;
  nextOrderIndex: number;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<ExamSectionType | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [totalPoints, setTotalPoints] = useState(10);
  const [sectionTitle, setSectionTitle] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const config = selectedType ? EXAM_SECTION_TYPES.find((t) => t.id === selectedType) ?? null : null;
  const pointsPerQuestion = questionCount > 0 && totalPoints > 0 ? totalPoints / questionCount : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div ref={modalRef} className="surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Thêm phần thi</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="btn btn-ghost btn-sm">✕</button>
        </div>

        <form action={createSectionWithQuestionsAction} className="mt-4 grid gap-4">
          <input type="hidden" name="contestId" value={contestId} />
          <input type="hidden" name="orderIndex" value={nextOrderIndex} />
          <input type="hidden" name="skillType" value={config?.skillType ?? ""} />
          <input type="hidden" name="questionType" value={config?.questionType ?? ""} />

          {/* Section type selection */}
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Chọn loại phần thi</p>
            <div className="grid gap-2">
              {EXAM_SECTION_TYPES.map((type) => (
                <label
                  key={type.id}
                  className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors ${
                    selectedType === type.id ? "bg-accent-soft ring-2 ring-accent" : "bg-panel-muted hover:bg-panel-muted/70"
                  }`}
                >
                  <input
                    type="radio"
                    name="sectionType"
                    value={type.id}
                    checked={selectedType === type.id}
                    onChange={() => {
                      setSelectedType(type.id);
                      setSectionTitle(type.label);
                      if (type.id === "WRITING") setQuestionCount(1);
                    }}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm font-semibold">{type.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-soft">
              Có thể thêm nhiều phần cùng loại, ví dụ Reading với 2–3 passage riêng.
            </p>
          </div>

          {config && (
            <>
              <label className="grid gap-1 text-sm font-semibold">
                Tiêu đề phần thi
                <input
                  name="title"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder={config.label}
                  className="field"
                />
              </label>

              {/* Question count and points */}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Số câu hỏi
                  <input
                    type="number"
                    name="questionCount"
                    min={1}
                    max={100}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="field"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Tổng điểm
                  <input
                    type="number"
                    name="points"
                    min={1}
                    step="0.5"
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(Number(e.target.value))}
                    className="field"
                  />
                </label>
              </div>

              <p className="text-xs text-ink-soft">
                {pointsPerQuestion !== null
                  ? `Hệ thống sẽ tạo sẵn ${questionCount} câu hỏi trống, mỗi câu ${Math.round(pointsPerQuestion * 100) / 100} điểm. Bạn nhập nội dung từng câu sau khi thêm.`
                  : "Nhập số câu hỏi và tổng điểm cho phần thi này."}
              </p>
              {config.id === "WRITING" ? (
                <p className="text-xs text-ink-soft">Với Writing, mỗi &quot;câu hỏi&quot; là một đề bài viết và sẽ được chấm tay.</p>
              ) : null}
              {config.hasAudio ? (
                <p className="text-xs text-ink-soft">Đường dẫn audio cho Listening được nhập trong phần thi sau khi thêm.</p>
              ) : null}
            </>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={!selectedType} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-55">
              Thêm phần thi
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Huỷ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main Edit Component ---

export function ContestBuilderEdit({ contest, sections, validationErrors, flashMessage, flashError }: Props) {
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const [showAddModal, setShowAddModal] = useState(false);
  const [visibility, setVisibility] = useState<ContestVisibility>(contest.visibility);
  const canPublish = contest.status === "DRAFT" || contest.status === "SCHEDULED";
  const isPublished = contest.status === "LIVE";
  const nextOrderIndex = sortedSections.reduce((max, s) => Math.max(max, s.orderIndex + 1), sortedSections.length);

  // The add-section form redirects back to this page; close the modal once the new section arrives.
  const [prevSectionCount, setPrevSectionCount] = useState(sections.length);
  if (prevSectionCount !== sections.length) {
    setPrevSectionCount(sections.length);
    setShowAddModal(false);
  }

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

      {/* Action buttons - sticky below the site header */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-background/95 px-4 py-3 backdrop-blur-sm">
        <span className="mr-1 rounded-full bg-panel-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {contestStatusLabels[contest.status]}
        </span>

        <button type="submit" form="contest-meta-form" className="btn btn-sm btn-secondary">
          <Save className="size-4" aria-hidden="true" />
          Lưu draft
        </button>

        {canPublish && (
          <form action={publishContestAction} className="inline">
            <input type="hidden" name="contestId" value={contest.id} />
            <button type="submit" className="btn btn-sm btn-primary">
              <Send className="size-4" aria-hidden="true" />
              Publish contest
            </button>
          </form>
        )}

        {isPublished && (
          <form action={archiveContestAction} className="inline">
            <input type="hidden" name="contestId" value={contest.id} />
            <button type="submit" className="btn btn-sm btn-ghost">
              Lưu trữ
            </button>
          </form>
        )}

        <Link href={`/contests/${contest.slug}/start?preview=1`} target="_blank" className="btn btn-sm btn-secondary">
          <Eye className="size-4" aria-hidden="true" />
          Preview contest ở góc nhìn thí sinh
        </Link>
      </div>

      {/* Contest metadata - simplified */}
      <section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Thông tin contest</h2>
        <form id="contest-meta-form" action={updateContestMetaAction} className="mt-4 grid gap-4">
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
          </div>

          <label className="grid gap-1.5 text-sm font-semibold">
            Mô tả
            <textarea name="description" defaultValue={contest.description ?? ""} rows={2} className="field" />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              Bắt đầu
              <input name="startsAt" type="datetime-local" defaultValue={toLocalDateTime(contest.startsAt)} className="field" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Kết thúc
              <input name="endsAt" type="datetime-local" defaultValue={toLocalDateTime(contest.endsAt)} className="field" />
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
                  <p className="text-xs text-ink-soft">Cần mã truy cập</p>
                </div>
              </label>
            </div>
          </div>

          {/* Access code for private */}
          {visibility === "PRIVATE" && (
            <label className="grid gap-1.5 text-sm font-semibold">
              Mã truy cập
              <input name="accessCode" defaultValue={contest.accessCode ?? ""} placeholder="VD: HSG2024" className="field" />
              <span className="font-normal text-ink-soft text-xs">Chia sẻ mã này riêng với người tham gia. Nhớ nhấn Lưu draft sau khi đổi.</span>
            </label>
          )}

          {/* Duration */}
          <div className="grid gap-3">
            <p className="text-sm font-semibold">Thời lượng</p>
            <div className="flex gap-3">
              {durationOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 rounded-xl bg-panel-muted px-4 py-3 cursor-pointer has-[:checked]:bg-accent-soft has-[:checked]:ring-2 has-[:checked]:ring-accent"
                >
                  <input
                    type="radio"
                    name="durationMinutes"
                    value={opt.value}
                    defaultChecked={contest.durationMinutes === opt.value}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-soft">Thông tin contest được lưu bằng nút &quot;Lưu draft&quot; ở thanh phía trên.</p>
          </div>
        </form>
      </section>

      {/* Sections - Exam Builder */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Phần thi ({sortedSections.length})</h2>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background"
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm phần thi
          </button>
        </div>

        <div className="grid gap-3">
          {sortedSections.map((section) => (
            <SectionCard key={section.id} contestId={contest.id} section={section} />
          ))}
          {sortedSections.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
              <p className="text-sm text-ink-soft">Chưa có phần thi nào. Nhấn &quot;Thêm phần thi&quot; để bắt đầu.</p>
            </div>
          )}
        </div>
      </section>

      {/* Add Section Modal */}
      {showAddModal && (
        <AddSectionModal
          contestId={contest.id}
          nextOrderIndex={nextOrderIndex}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
