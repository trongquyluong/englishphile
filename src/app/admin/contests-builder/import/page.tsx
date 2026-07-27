"use client";

import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, X, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ParsedContest, ParseError, ParseWarning } from "@/lib/import/excel-contest-parser";
import { importContestFromParsedAction } from "@/app/admin/contests-builder/actions";

export type ParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "preview"; data: ParsedContest; errors: ParseError[]; warnings: ParseWarning[] }
  | { status: "validation"; errors: ParseError[]; warnings: ParseWarning[] }
  | { status: "done"; contestId: string }
  | { status: "error"; message: string };

const FORMULA_VALIDATION_MESSAGE = "File Excel chứa công thức không được phép. Hãy chuyển công thức thành giá trị tĩnh rồi upload lại.";
const GENERIC_PARSE_ERROR = "Không thể phân tích file Excel. Vui lòng kiểm tra file và thử lại.";
const MAX_RENDERED_ISSUES = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIssue(value: unknown): ParseError | null {
  if (
    !isRecord(value)
    || typeof value.sheet !== "string"
    || typeof value.field !== "string"
    || typeof value.message !== "string"
    || typeof value.row !== "number"
    || !Number.isSafeInteger(value.row)
  ) {
    return null;
  }

  const code = value.code === "FORMULA_NOT_ALLOWED" ? value.code : undefined;
  return {
    sheet: value.sheet.slice(0, 80),
    row: value.row,
    field: value.field.slice(0, 80),
    message: code === "FORMULA_NOT_ALLOWED"
      ? FORMULA_VALIDATION_MESSAGE
      : value.message.slice(0, 500),
    ...(code ? { code } : {}),
  };
}

function normalizeIssues(value: unknown): ParseError[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.slice(0, MAX_RENDERED_ISSUES).map(normalizeIssue);
  if (normalized.some((issue) => issue === null)) return null;
  return normalized as ParseError[];
}

function normalizeWarnings(value: unknown): ParseWarning[] | null {
  const issues = normalizeIssues(value);
  return issues?.map(({ sheet, row, field, message }) => ({ sheet, row, field, message })) ?? null;
}

function isParsedContest(value: unknown): value is ParsedContest {
  if (!isRecord(value) || !isRecord(value.info) || !Array.isArray(value.sections) || !Array.isArray(value.questions)) {
    return false;
  }

  const info = value.info;
  if (
    typeof info.title !== "string"
    || (info.description !== null && typeof info.description !== "string")
    || typeof info.visibility !== "string"
    || (info.durationMinutes !== null && typeof info.durationMinutes !== "number")
    || (info.startAt !== null && typeof info.startAt !== "string")
    || (info.endAt !== null && typeof info.endAt !== "string")
  ) {
    return false;
  }

  const sectionsValid = value.sections.every((section) => (
    isRecord(section)
    && typeof section.sectionId === "string"
    && typeof section.sectionType === "string"
    && typeof section.title === "string"
    && typeof section.questionCount === "number"
    && typeof section.totalPoints === "number"
    && (section.audioUrl === null || typeof section.audioUrl === "string")
    && (section.passageText === null || typeof section.passageText === "string")
  ));
  const questionsValid = value.questions.every((question) => (
    isRecord(question)
    && typeof question.sectionId === "string"
    && (question.points === null || typeof question.points === "number")
  ));
  return sectionsValid && questionsValid;
}

export function parseContestResponse(payload: unknown): ParseState {
  if (!isRecord(payload)) return { status: "error", message: GENERIC_PARSE_ERROR };

  const errors = normalizeIssues(payload.errors);
  const warnings = normalizeWarnings(payload.warnings);
  if (!errors || !warnings) return { status: "error", message: GENERIC_PARSE_ERROR };

  if (errors.length > 0) {
    return { status: "validation", errors, warnings };
  }
  if (!isParsedContest(payload.data)) {
    return { status: "error", message: GENERIC_PARSE_ERROR };
  }
  return { status: "preview", data: payload.data, errors: [], warnings };
}

function parseHttpError(status: number): string {
  if (status === 403) return "Bạn không có quyền phân tích file contest.";
  if (status === 413) return "File Excel vượt giới hạn kích thước cho phép.";
  if (status === 429) return "Bạn đã phân tích quá nhiều file. Vui lòng thử lại sau.";
  if (status === 503) return "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.";
  if (status >= 400 && status < 500) return "File Excel không hợp lệ hoặc không được chấp nhận.";
  return GENERIC_PARSE_ERROR;
}

export async function requestContestWorkbookParse(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<ParseState> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetcher("/api/admin/contests-import/parse", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) return { status: "error", message: parseHttpError(response.status) };
  return parseContestResponse(await response.json() as unknown);
}

interface FileSelectionDependencies {
  setSelectedFile: (file: File) => void;
  setParseState: (state: ParseState) => void;
  fetcher?: typeof fetch;
}

export async function processContestFileSelection(
  event: Pick<React.ChangeEvent<HTMLInputElement>, "target">,
  dependencies: FileSelectionDependencies,
): Promise<void> {
  const file = event.target.files?.[0] ?? null;
  if (!file) return;

  dependencies.setSelectedFile(file);
  dependencies.setParseState({ status: "parsing" });
  try {
    dependencies.setParseState(await requestContestWorkbookParse(file, dependencies.fetcher));
  } catch {
    dependencies.setParseState({ status: "error", message: GENERIC_PARSE_ERROR });
  }
}

const sectionTypeLabels: Record<string, string> = {
  UOE_MCQ: "Use of English — MCQ",
  WORD_FORMATION: "Word Formation",
  OPEN_CLOZE: "Open Cloze",
  GUIDED_CLOZE: "Guided Cloze",
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function SectionPreviewRow({ section, actualCount, actualPoints }: {
  section: ParsedContest["sections"][number];
  actualCount: number;
  actualPoints: number;
}) {
  const qMismatch = section.questionCount !== actualCount;
  const pMismatch = Math.abs(section.totalPoints - actualPoints) > 0.01;
  const isListening = section.sectionType.trim().toUpperCase() === "LISTENING";

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2.5 text-sm">
        <span className="font-semibold">{section.title}</span>
        <p className="text-xs text-ink-soft">{section.sectionId}</p>
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-soft">
        {sectionTypeLabels[section.sectionType] ?? section.sectionType}
      </td>
      <td className="px-3 py-2.5 text-center text-sm tabular-nums">
        {section.questionCount}
        {qMismatch && (
          <span className="ml-1 text-xs text-orange-500" title={`Thực tế: ${actualCount} câu`}>→{actualCount}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center text-sm tabular-nums">
        {section.totalPoints}
        {pMismatch && (
          <span className="ml-1 text-xs text-orange-500" title={`Tổng câu hỏi: ${actualPoints.toFixed(1)}`}>→{actualPoints.toFixed(1)}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-soft">
        {isListening ? (
          section.audioUrl ? (
            <span className="text-green-600">✓ audio</span>
          ) : (
            <span className="text-orange-500">chưa có audio</span>
          )
        ) : section.sectionType.trim().toUpperCase() === "READING" ? (
          section.passageText ? (
            <span className="text-green-600">✓ passage</span>
          ) : (
            <span className="text-orange-500">chưa có passage</span>
          )
        ) : null}
      </td>
    </tr>
  );
}

interface ContestImportViewProps {
  state: ParseState;
  isImporting: boolean;
  selectedFile: File | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onEditFile: () => void;
}

export function ContestImportView({
  state,
  isImporting,
  selectedFile,
  fileInputRef,
  onFileChange,
  onConfirm,
  onCancel,
  onEditFile,
}: ContestImportViewProps) {
  return (
    <div className="grid gap-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Link href="/admin/contests-builder" className="text-sm text-ink-soft hover:text-accent">← Contest Builder</Link>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Nhập contest từ Excel</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Upload file Excel theo template để tạo nhanh toàn bộ contest — thông tin, phần thi và câu hỏi.
        </p>
      </div>

      {/* Done state */}
      {state.status === "done" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-green-500" />
          <h2 className="mt-3 text-lg font-semibold text-green-800">Đã tạo contest draft!</h2>
          <p className="mt-1 text-sm text-green-700">Contest đã được tạo ở trạng thái DRAFT. Kiểm tra lại và xuất bản khi sẵn sàng.</p>
          <Link href={`/admin/contests-builder/${state.contestId}/edit`} className="mt-4 inline-flex items-center gap-2 btn btn-primary">
            Mở contest để chỉnh sửa
          </Link>
        </div>
      )}

      {/* Error state */}
      {state.status === "error" && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertCircle className="size-4" />
            {state.message}
          </p>
        </div>
      )}

      {/* Expected workbook validation state */}
      {state.status === "validation" && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertCircle className="size-4 shrink-0" />
            File Excel chưa hợp lệ — không thể tạo contest draft.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-danger">
            {state.errors.map((error, index) => (
              <li key={`${error.sheet}-${error.row}-${error.field}-${index}`}>
                {error.sheet ? `${error.sheet} · ` : ""}{error.field}: {error.message}
              </li>
            ))}
          </ul>
          {state.warnings.length > 0 && (
            <p className="mt-2 text-xs text-danger">
              File còn có {state.warnings.length} cảnh báo; hãy sửa lỗi trước khi xem lại cảnh báo.
            </p>
          )}
        </div>
      )}

      {/* Upload form — shown when idle or ready to re-upload */}
      {(state.status === "idle" || state.status === "error" || state.status === "validation") && (
        <div className="surface rounded-2xl p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft">
              <FileSpreadsheet className="size-7 text-accent-strong" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Chọn file Excel (.xlsx)</p>
              <p className="mt-1 text-sm text-ink-soft">
                File phải có các sheet: Contest_Info, Sections, Questions.
              </p>
            </div>

            {/* Template download */}
            <div className="flex gap-3">
              <a href="/templates/englishphile_contest_import_template.xlsx" download className="btn btn-secondary text-sm">
                <FileSpreadsheet className="size-4" />
                Download template Excel
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary text-sm"
              >
                <Upload className="size-4" />
                Chọn file để upload
              </button>
            </div>
            <p className="text-xs text-ink-soft">
              Dùng template Excel để nhập nhanh toàn bộ đề thi. File nghe Listening sẽ được upload/nhập đường dẫn riêng.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>
      )}

      {/* Parsing loading */}
      {state.status === "parsing" && (
        <div className="rounded-2xl border border-line bg-panel-muted px-6 py-8 text-center">
          <p className="text-sm text-ink-soft">Đang phân tích file…</p>
        </div>
      )}

      {/* Preview */}
      {state.status === "preview" && (
        <div className="grid gap-5">
          {/* Contest summary */}
          <div className="surface rounded-2xl p-5">
            <h2 className="text-base font-semibold">{state.data.info.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{state.data.info.description ?? "Không có mô tả."}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
              <span>👁 <strong className="font-medium text-foreground">{state.data.info.visibility}</strong></span>
              <span>⏱ {state.data.info.durationMinutes ?? "?"} phút</span>
              <span>▶ {formatDate(state.data.info.startAt)}</span>
              <span>■ {formatDate(state.data.info.endAt)}</span>
            </div>
          </div>

          {/* Warnings */}
          {state.warnings.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                <AlertTriangle className="size-4 shrink-0" />
                Cảnh báo ({state.warnings.length})
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-orange-700">
                {state.warnings.map((w, i) => (
                  <li key={i}>
                    {w.sheet} · {w.field}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {state.errors.length > 0 && (
            <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                <AlertCircle className="size-4 shrink-0" />
                Lỗi ({state.errors.length}) — Không thể import
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-danger">
                {state.errors.map((e, i) => (
                  <li key={i}>
                    {e.sheet} · {e.field}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sections table */}
          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold">
                Phần thi ({state.data.sections.length}) ·{" "}
                {state.data.questions.length} câu ·{" "}
                {state.data.sections.reduce((s, sec) => s + sec.totalPoints, 0)} điểm
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-panel-muted text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 text-left">Phần thi</th>
                  <th className="px-3 py-2 text-left">Loại</th>
                  <th className="px-3 py-2 text-center">Số câu</th>
                  <th className="px-3 py-2 text-center">Điểm</th>
                  <th className="px-3 py-2 text-left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {state.data.sections.map((section) => {
                  const actualCount = state.data.questions.filter((q) => q.sectionId === section.sectionId).length;
                  const actualPoints = state.data.questions
                    .filter((q) => q.sectionId === section.sectionId)
                    .reduce((sum, q) => sum + (q.points ?? 0), 0);
                  return (
                    <SectionPreviewRow
                      key={section.sectionId}
                      section={section}
                      actualCount={actualCount}
                      actualPoints={actualPoints}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isImporting ? (
              <button disabled className="btn btn-primary opacity-55">
                Đang tạo contest…
              </button>
            ) : (
              <button onClick={onConfirm} className="btn btn-primary">
                Tạo contest draft
              </button>
            )}
            <button
              onClick={onCancel}
              className="btn btn-ghost"
            >
              Huỷ
            </button>
            {selectedFile && (
              <button
                onClick={onEditFile}
                className="btn btn-ghost text-xs text-ink-soft"
              >
                <X className="size-3.5" />
                Sửa file rồi upload lại
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportContestPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await processContestFileSelection(event, {
      setSelectedFile,
      setParseState,
    });
  }

  async function handleConfirm() {
    const state = parseState;
    if (state.status !== "preview") return;

    setIsImporting(true);
    try {
      const result = await importContestFromParsedAction(state.data);
      if (result.ok) {
        setParseState({ status: "done", contestId: result.contestId });
      } else {
        setParseState({ status: "error", message: result.error });
      }
    } catch {
      setParseState({
        status: "error",
        message: "Không thể tạo contest draft. Vui lòng thử lại sau.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  function resetSelection() {
    setParseState({ status: "idle" });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <ContestImportView
      state={parseState}
      isImporting={isImporting}
      selectedFile={selectedFile}
      fileInputRef={fileInputRef}
      onFileChange={handleFileChange}
      onConfirm={handleConfirm}
      onCancel={resetSelection}
      onEditFile={resetSelection}
    />
  );
}
