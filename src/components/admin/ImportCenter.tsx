"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Database,
  FileJson,
  FileSpreadsheet,
  Files,
  History,
  Info,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ImportPlan } from "@/lib/import/types";
import { csvTemplate, type ImportTemplate } from "@/lib/import/templates";
import { difficultyLabels, questionTypeLabels, skillLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ImportHistoryItem = {
  id: string;
  createdAt: string;
  userName: string;
  importType: string;
  status: string;
  sourceName: string | null;
  summary: Record<string, unknown>;
};

type ImportCenterProps = {
  history: ImportHistoryItem[];
  templates: ImportTemplate[];
};

type ImportKind = "JSON" | "CSV";
type Tab = "files" | "json" | "csv" | "history" | "templates" | "guidelines";

type UploadedContentFile = {
  fileName: string;
  content: string;
  size: number;
};

type ContentPackFilePlan = {
  fileName: string;
  importType: ImportKind;
  identity: { entryId: string };
  plan: ImportPlan | null;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
};

type ContentPackValidationResult = {
  manifest: Record<string, unknown> | null;
  packName: string;
  version: string | null;
  description: string | null;
  ignoredFiles: string[];
  files: ContentPackFilePlan[];
  summary: {
    fileCount: number;
    validFiles: number;
    invalidFiles: number;
    ignoredFiles: number;
    problemsToCreate: number;
    questionsToCreate: number;
    duplicatesSkipped: number;
    exactDuplicateQuestionsSkipped: number;
    highSimilarityQuestionsSkipped: number;
    possibleDuplicateQuestionsFlagged: number;
    errors: number;
    warnings: number;
  };
};

type ContentPackImportResult = ContentPackValidationResult & {
  contentPack: {
    id: string;
    name: string;
    status: string;
  };
  results: Array<{
    entryId: string;
    fileName: string;
    status: string;
    batchId?: string;
    problemsImported: number;
    questionsImported: number;
  }>;
};

const sampleJson = `{
  "sourceCollection": {
    "name": "Admin Demo JSON",
    "description": "Nguồn mẫu tự viết.",
    "originalFileName": "admin-demo.json",
    "sourceType": "JSON",
    "copyrightNote": "Original sample content."
  },
  "problems": [
    {
      "title": "Imported word formation demo",
      "slug": "imported-word-formation-demo",
      "skillType": "WORD_FORMATION",
      "questionType": "WORD_FORMATION",
      "difficulty": "CHUYEN",
      "statement": "Điền dạng đúng của từ trong ngoặc.",
      "instructions": "Xác định loại từ trước khi điền.",
      "estimatedMinutes": 5,
      "topics": ["Word Class", "Suffixes"],
      "questions": [
        {
          "type": "WORD_FORMATION",
          "skillType": "WORD_FORMATION",
          "difficulty": "CHUYEN",
          "prompt": "The judge admired the ____ of her response. (PRECISE)",
          "passage": null,
          "options": null,
          "answer": {
            "accepted": ["precision"],
            "display": "precision"
          },
          "explanation": "Sau the cần danh từ.",
          "rootWord": "PRECISE",
          "keyword": null,
          "targetSentence": null,
          "lineNumber": null,
          "metadata": {
            "wordClass": "noun",
            "note": "precise → precision"
          }
        }
      ]
    }
  ]
}`;

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "files", label: "Tải gói dữ liệu lên", icon: Upload },
  { id: "history", label: "Lịch sử import", icon: History },
  { id: "templates", label: "Template mẫu", icon: Clipboard },
  { id: "guidelines", label: "Hướng dẫn import", icon: Info },
  { id: "json", label: "JSON thủ công", icon: FileJson },
  { id: "csv", label: "CSV thủ công", icon: FileSpreadsheet },
];

function summaryNumber(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === "number" ? value : 0;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "IMPORTED"
      ? "bg-accent-soft text-accent-strong"
      : status === "FAILED"
        ? "bg-red-50 text-danger"
        : "bg-panel-muted text-ink-soft";

  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", tone)}>{status}</span>;
}

function formatSimilarity(value: number) {
  return `${Math.round(value * 100)}%`;
}

function IssueCard({ issue }: { issue: ImportPlan["issues"][number] }) {
  return (
    <div className="rounded-md bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
      <div className="flex items-center gap-2">
        {issue.level === "error" ? (
          <TriangleAlert className="size-4 text-danger" aria-hidden="true" />
        ) : (
          <Info className="size-4 text-warning" aria-hidden="true" />
        )}
        <span className="font-semibold">{issue.level === "error" ? "Lỗi" : "Cảnh báo"}</span>
        {issue.code ? <span className="rounded bg-panel-muted px-1.5 py-0.5 text-xs font-semibold text-ink-soft">{issue.code}</span> : null}
      </div>
      <p className="mt-1 text-xs text-ink-soft">{issue.path}</p>
      <p className="mt-1 leading-6">{issue.message}</p>
      {issue.duplicate ? (
        <div className="mt-3 rounded-md bg-panel-muted p-2 text-xs leading-5 text-ink-soft">
          <p>
            Độ giống: <span className="font-semibold text-foreground">{formatSimilarity(issue.duplicate.similarity)}</span> · Hành động:{" "}
            <span className="font-semibold text-foreground">
              {issue.duplicate.action === "skip" ? "bỏ qua" : "import để duyệt"}
            </span>
          </p>
          {issue.duplicate.existingProblemTitle ? <p>Bài gần giống: {issue.duplicate.existingProblemTitle}</p> : null}
          {issue.duplicate.existingPromptExcerpt ? <p>Prompt gần giống: {issue.duplicate.existingPromptExcerpt}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function PlanPreview({ plan }: { plan: ImportPlan }) {
  return (
    <div className="divide-y divide-line">
      {plan.preview.map((problem) => (
        <div key={problem.slug} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_140px_140px_100px_120px] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              {problem.action === "create" ? (
                <CheckCircle2 className="size-4 text-accent" aria-hidden="true" />
              ) : (
                <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
              )}
              <p className="font-semibold">{problem.title}</p>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{problem.slug}</p>
            {problem.messages.length ? <p className="mt-2 text-xs text-warning">{problem.messages.join(" ")}</p> : null}
          </div>
          <span className="text-sm text-ink-soft">{skillLabels[problem.skillType]}</span>
          <span className="text-sm text-ink-soft">{questionTypeLabels[problem.questionType]}</span>
          <span className="text-sm font-semibold">{difficultyLabels[problem.difficulty]}</span>
          <span className="tabular text-sm text-ink-soft">{problem.questionCount} câu</span>
        </div>
      ))}
    </div>
  );
}

export function ImportCenter({ history, templates }: ImportCenterProps) {
  const [activeTab, setActiveTab] = useState<Tab>("files");
  const [jsonText, setJsonText] = useState(sampleJson);
  const [csvText, setCsvText] = useState(csvTemplate);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [filePlan, setFilePlan] = useState<ContentPackValidationResult | null>(null);
  const [fileImportResult, setFileImportResult] = useState<ContentPackImportResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<UploadedContentFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importKind: ImportKind = activeTab === "csv" ? "CSV" : "JSON";
  const activeContent = activeTab === "csv" ? csvText : jsonText;
  const canImport = Boolean(plan?.ok && plan.summary.problemsToCreate > 0);
  const canImportFiles = Boolean(filePlan && filePlan.summary.validFiles > 0);

  const summaryCards = useMemo(() => {
    if (!plan) return [];
    return [
      ["Nguồn tạo mới", plan.summary.sourceCollectionsToCreate],
      ["Topic tạo mới", plan.summary.topicsToCreate],
      ["Problems tạo mới", plan.summary.problemsToCreate],
      ["Questions tạo mới", plan.summary.questionsToCreate],
      ["Problem trùng bỏ qua", plan.summary.duplicateProblemsSkipped],
      ["Question trùng bỏ qua", plan.summary.duplicateQuestionsSkipped],
      ["Trùng chính xác", plan.summary.exactDuplicateQuestionsSkipped],
      ["Rất giống bị bỏ qua", plan.summary.highSimilarityQuestionsSkipped],
      ["Có thể trùng cần duyệt", plan.summary.possibleDuplicateQuestionsFlagged],
      ["Lỗi", plan.summary.errors],
    ];
  }, [plan]);

  const fileSummaryCards = useMemo(() => {
    if (!filePlan) return [];
    return [
      ["File hợp lệ", filePlan.summary.validFiles],
      ["File lỗi", filePlan.summary.invalidFiles],
      ["File bỏ qua", filePlan.summary.ignoredFiles],
      ["Problems tạo mới", filePlan.summary.problemsToCreate],
      ["Questions tạo mới", filePlan.summary.questionsToCreate],
      ["Trùng bỏ qua", filePlan.summary.duplicatesSkipped],
      ["Trùng chính xác", filePlan.summary.exactDuplicateQuestionsSkipped],
      ["Rất giống bị bỏ qua", filePlan.summary.highSimilarityQuestionsSkipped],
      ["Có thể trùng cần duyệt", filePlan.summary.possibleDuplicateQuestionsFlagged],
      ["Lỗi", filePlan.summary.errors],
      ["Cảnh báo", filePlan.summary.warnings],
    ];
  }, [filePlan]);

  const callImportApi = async (mode: "validate" | "commit") => {
    setIsWorking(true);
    setMessage(null);
    const response = await fetch(`/api/admin/import/${mode === "validate" ? "validate" : "commit"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importType: importKind,
        content: activeContent,
        publishImmediately: mode === "commit" ? publishImmediately : undefined,
      }),
    });
    const payload = (await response.json()) as ImportPlan & { error?: string; status?: string };
    if (!response.ok && payload.error) {
      setMessage(payload.error);
    } else {
      setPlan(payload);
      setMessage(
        mode === "validate"
          ? payload.ok
            ? "Kiểm tra dữ liệu xong. Có thể import vào database."
            : "Đã kiểm tra xong, nhưng còn lỗi cần sửa."
          : payload.status === "IMPORTED"
            ? "Import vào database thành công."
            : "Import thất bại. Xem lỗi bên dưới.",
      );
    }
    setIsWorking(false);
  };

  const callFileApi = async (mode: "validate" | "commit") => {
    setIsWorking(true);
    setMessage(null);
    setFileImportResult(null);
    const response = await fetch(`/api/admin/import/files/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: selectedFiles.map((file) => ({ fileName: file.fileName, content: file.content })),
        publishImmediately: mode === "commit" ? publishImmediately : undefined,
      }),
    });
    const payload = (await response.json()) as ContentPackValidationResult & ContentPackImportResult & { error?: string };
    if (!response.ok && payload.error) {
      setMessage(payload.error);
    } else {
      setFilePlan(payload);
      if ("contentPack" in payload) {
        setFileImportResult(payload);
      }
      setMessage(
        mode === "validate"
          ? payload.summary.validFiles > 0
            ? "Đã kiểm tra file. Có thể import tất cả file hợp lệ."
            : "Không có file hợp lệ để import."
          : "Import nhiều file hoàn tất. File lỗi hoặc problem trùng đã được bỏ qua.",
      );
    }
    setIsWorking(false);
  };

  const setActive = (tab: Tab) => {
    setActiveTab(tab);
    setPlan(null);
    setFilePlan(null);
    setFileImportResult(null);
    setMessage(null);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const accepted = files.filter((file) => /\.(json|csv)$/i.test(file.name));
    const zipCount = files.filter((file) => /\.zip$/i.test(file.name)).length;
    const rejectedCount = files.length - accepted.length;
    const nextFiles = await Promise.all(
      accepted.map(async (file) => ({
        fileName: file.name,
        content: await file.text(),
        size: file.size,
      })),
    );
    setSelectedFiles(nextFiles);
    setFilePlan(null);
    setFileImportResult(null);
    setMessage(
      rejectedCount > 0
        ? `Đã chọn ${nextFiles.length} file JSON/CSV. ${zipCount ? "ZIP chưa hỗ trợ trực tiếp; hãy giải nén rồi chọn nhiều file. " : ""}${rejectedCount} file không hỗ trợ đã bị bỏ qua.`
        : `Đã chọn ${nextFiles.length} file JSON/CSV.`,
    );
  };

  return (
    <div className="grid gap-5">
      <div className="surface flex flex-wrap gap-2 rounded-lg p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-[background-color,color] duration-150",
                activeTab === tab.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-panel-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {(activeTab === "json" || activeTab === "csv") && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="surface rounded-lg p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-accent">Chế độ nâng cao</p>
                <h2 className="mt-1 text-xl font-semibold">{activeTab === "json" ? "Nhập thủ công JSON" : "Nhập thủ công CSV"}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Dành cho debug hoặc dữ liệu ngắn. Quy trình chính nên dùng upload file/gói dữ liệu ở tab đầu tiên.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => callImportApi("validate")}
                  disabled={isWorking}
                  className="min-h-10 rounded-md bg-panel-muted px-3 text-sm font-semibold text-foreground transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
                >
                  Kiểm tra dữ liệu
                </button>
                <button
                  type="button"
                  onClick={() => callImportApi("commit")}
                  disabled={isWorking || !canImport}
                  className="min-h-10 rounded-md bg-foreground px-3 text-sm font-semibold text-background transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
                >
                  Import vào database
                </button>
              </div>
            </div>

            <textarea
              value={activeTab === "json" ? jsonText : csvText}
              onChange={(event) => {
                if (activeTab === "json") setJsonText(event.target.value);
                else setCsvText(event.target.value);
                setPlan(null);
              }}
              spellCheck={false}
              className="mt-5 min-h-[420px] w-full rounded-lg bg-white p-4 font-mono text-xs leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2"
            />

            <label className="mt-4 flex min-h-10 items-start gap-3 rounded-lg bg-panel-muted px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(event) => setPublishImmediately(event.target.checked)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="font-semibold">Publish ngay sau khi import</span>
                <span className="mt-1 block text-ink-soft">
                  Mặc định nội dung import sẽ ở trạng thái Cần duyệt. Chỉ bật tùy chọn này khi quản trị đã kiểm tra dữ liệu.
                </span>
              </span>
            </label>

            {message ? <p className="mt-4 rounded-md bg-panel-muted px-3 py-2 text-sm font-medium text-foreground">{message}</p> : null}
          </div>

          <aside className="grid h-fit gap-4">
            <div className="surface rounded-lg p-5">
              <h3 className="text-lg font-semibold">Tóm tắt dry-run</h3>
              {plan ? (
                <div className="mt-4 grid gap-2">
                  {summaryCards.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                      <span className="text-ink-soft">{label}</span>
                      <span className="tabular font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink-soft">Chưa có kết quả kiểm tra.</p>
              )}
            </div>

            {plan ? (
              <div className="surface rounded-lg p-5">
                <h3 className="text-lg font-semibold">Lỗi và cảnh báo</h3>
                <div className="mt-4 grid max-h-96 gap-2 overflow-auto">
                  {plan.issues.length ? (
                    plan.issues.map((issue, index) => (
                      <IssueCard key={`${issue.path}-${index}`} issue={issue} />
                    ))
                  ) : (
                    <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">Không có lỗi.</p>
                  )}
                </div>
              </div>
            ) : null}
          </aside>

          {plan ? (
            <div className="surface overflow-hidden rounded-lg lg:col-span-2">
              <div className="border-b border-line px-5 py-4">
                <h3 className="text-lg font-semibold">Xem trước</h3>
              </div>
              <PlanPreview plan={plan} />
            </div>
          ) : null}
        </section>
      )}

      {activeTab === "files" && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="surface rounded-lg p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-accent">Upload-first import</p>
                <h2 className="mt-1 text-xl font-semibold">Tải gói dữ liệu lên</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  Kéo thả hoặc chọn nhiều file JSON/CSV đã chuẩn hóa. Nếu có manifest.json và các file 01–xx, hệ thống sẽ ưu tiên split files và bỏ qua 00-all-in-one để tránh trùng.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold"
                >
                  <Files className="size-4" aria-hidden="true" />
                  Chọn file JSON/CSV
                </button>
                <button
                  type="button"
                  onClick={() => callFileApi("validate")}
                  disabled={isWorking || selectedFiles.length === 0}
                  className="min-h-10 rounded-md bg-panel-muted px-3 text-sm font-semibold disabled:opacity-60"
                >
                  Kiểm tra dữ liệu
                </button>
                <button
                  type="button"
                  onClick={() => callFileApi("commit")}
                  disabled={isWorking || !canImportFiles}
                  className="min-h-10 rounded-md bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-50"
                >
                  Import tất cả file hợp lệ
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,.csv,.zip,application/json,text/csv,application/zip"
              onChange={(event) => handleFiles(event.target.files)}
              className="sr-only"
            />

            <label className="mt-5 flex min-h-10 items-start gap-3 rounded-lg bg-panel-muted px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(event) => setPublishImmediately(event.target.checked)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="font-semibold">Publish ngay sau khi import</span>
                <span className="mt-1 block text-ink-soft">
                  Mặc định file import sẽ tạo nội dung Cần duyệt để quản trị chạy QA và preview trước.
                </span>
              </span>
            </label>

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void handleFiles(event.dataTransfer.files);
              }}
              className={cn(
                "mt-5 grid cursor-pointer gap-3 rounded-xl border border-dashed px-5 py-8 text-center transition-[background-color,border-color,box-shadow] duration-150",
                isDragging ? "border-accent bg-accent-soft shadow-[var(--shadow-border-hover)]" : "border-line bg-white hover:bg-panel-muted",
              )}
            >
              <Upload className="mx-auto size-8 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Kéo thả file JSON/CSV/ZIP vào đây</p>
                <p className="mt-1 text-sm text-ink-soft">
                  ZIP chưa hỗ trợ trực tiếp; hãy giải nén rồi upload nhiều file JSON/CSV.
                </p>
              </div>
            </div>

            {selectedFiles.length ? (
              <div className="mt-4 grid gap-2">
                {selectedFiles.map((file) => (
                  <div key={file.fileName} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                    <span className="font-medium">{file.fileName}</span>
                    <span className="tabular text-xs text-ink-soft">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  </div>
                ))}
              </div>
            ) : null}

            {message ? <p className="mt-4 rounded-md bg-panel-muted px-3 py-2 text-sm font-medium text-foreground">{message}</p> : null}
          </div>

          <aside className="grid h-fit gap-4">
            <div className="surface rounded-lg p-5">
              <h3 className="text-lg font-semibold">Tóm tắt gói dữ liệu</h3>
              {filePlan ? (
                <div className="mt-4 grid gap-2">
                  <div className="rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                    <p className="font-semibold">{filePlan.packName}</p>
                    <p className="mt-1 text-xs text-ink-soft">{filePlan.version ? `Version ${filePlan.version}` : "Chưa có version"}</p>
                  </div>
                  {fileSummaryCards.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                      <span className="text-ink-soft">{label}</span>
                      <span className="tabular font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink-soft">Chưa có kết quả kiểm tra file.</p>
              )}
            </div>

            {fileImportResult ? (
              <div className="surface rounded-lg p-5">
                <h3 className="text-lg font-semibold">Sau import</h3>
                <div className="mt-4 grid gap-2">
                  <Link href={`/admin/content-packs/${fileImportResult.contentPack.id}`} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">
                    Xem gói dữ liệu
                  </Link>
                  <Link href={`/admin/content-qa?contentPackId=${fileImportResult.contentPack.id}`} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                    Chạy QA
                  </Link>
                  <Link href={`/admin/review?contentPackId=${fileImportResult.contentPack.id}`} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                    Duyệt ngay
                  </Link>
                  <Link href={`/admin/content-packs/${fileImportResult.contentPack.id}`} className="rounded-md bg-panel-muted px-3 py-2 text-sm font-semibold">
                    Publish bài hợp lệ
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>

          {filePlan ? (
            <div className="grid gap-4 lg:col-span-2">
              {filePlan.ignoredFiles.length ? (
                <div className="surface rounded-lg p-5">
                  <h3 className="text-lg font-semibold">File được bỏ qua</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    Các file này không import vì đã có split files 01-10. Muốn dùng all-in-one, chỉ chọn riêng file đó.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filePlan.ignoredFiles.map((fileName) => (
                      <span key={fileName} className="rounded-md bg-panel-muted px-2 py-1 text-xs font-semibold text-ink-soft">
                        {fileName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {fileImportResult ? (
                <div className="surface overflow-hidden rounded-lg">
                  <div className="border-b border-line px-5 py-4">
                    <h3 className="text-lg font-semibold">Kết quả import</h3>
                  </div>
                  <div className="divide-y divide-line">
                    {fileImportResult.results.map((result) => (
                      <div key={result.entryId} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_110px_120px_120px] sm:items-center">
                        <p className="font-semibold">{result.fileName}</p>
                        <StatusBadge status={result.status} />
                        <span className="tabular text-sm text-ink-soft">{result.problemsImported} problems</span>
                        <span className="tabular text-sm text-ink-soft">{result.questionsImported} questions</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {filePlan.files.map((file) => (
                <article key={file.identity.entryId} className="surface overflow-hidden rounded-lg">
                  <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{file.fileName}</h3>
                      <p className="mt-1 text-xs text-ink-soft">
                        {file.skipped ? file.skipReason ?? "File bị bỏ qua" : `${file.importType} · ${file.plan?.preview.length ?? 0} problems preview`}
                      </p>
                    </div>
                    {file.plan?.ok ? (
                      <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">File hợp lệ</span>
                    ) : (
                      <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-danger">File lỗi</span>
                    )}
                  </div>
                  {file.errors.length ? (
                    <div className="grid gap-2 border-b border-line bg-red-50/60 px-5 py-4 text-sm text-danger">
                      {file.errors.map((error, index) => (
                        <p key={`${file.fileName}-error-${index}`}>{error}</p>
                      ))}
                    </div>
                  ) : null}
                  {file.plan ? <PlanPreview plan={file.plan} /> : null}
                  {file.plan?.issues.length ? (
                    <div className="grid gap-2 border-t border-line bg-panel-muted/55 px-5 py-4">
                      {file.plan.issues.slice(0, 6).map((issue, index) => (
                        <IssueCard key={`${file.fileName}-${issue.path}-${index}`} issue={issue} />
                      ))}
                      {file.plan.issues.length > 6 ? (
                        <p className="text-sm text-ink-soft">Còn {file.plan.issues.length - 6} lỗi/cảnh báo khác trong file này.</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {activeTab === "history" && (
        <section className="surface overflow-hidden rounded-lg">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-xl font-semibold">Lịch sử import</h2>
          </div>
          <div className="divide-y divide-line">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[160px_90px_110px_1fr_170px] lg:items-center">
                  <div>
                    <p className="text-sm font-semibold">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
                    <p className="mt-1 text-xs text-ink-soft">{item.userName}</p>
                  </div>
                  <span className="text-sm font-semibold">{item.importType}</span>
                  <StatusBadge status={item.status} />
                  <span className="text-sm text-ink-soft">{item.sourceName ?? "Nhiều nguồn hoặc chưa tạo nguồn"}</span>
                  <span className="tabular text-sm text-ink-soft">
                    {summaryNumber(item.summary, "problemsImported")} problems · {summaryNumber(item.summary, "questionsImported")} questions
                  </span>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-ink-soft">Chưa có lịch sử import.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === "templates" && (
        <section className="grid gap-4">
          <div className="surface rounded-lg p-5">
            <h2 className="text-xl font-semibold">Tải template mẫu</h2>
            <p className="mt-2 text-sm text-ink-soft">Các mẫu dưới đây dùng nội dung ngắn tự viết. Có thể copy trực tiếp vào ô import.</p>
          </div>
          {templates.map((template) => (
            <article key={template.title} className="surface rounded-lg p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{template.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{template.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(template.content)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-panel-muted px-3 text-sm font-semibold"
                >
                  <Clipboard className="size-4" aria-hidden="true" />
                  Copy
                </button>
              </div>
              <textarea readOnly value={template.content} className="mt-4 min-h-64 w-full rounded-lg bg-white p-4 font-mono text-xs leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)]" />
            </article>
          ))}
        </section>
      )}

      {activeTab === "guidelines" && (
        <section className="surface rounded-lg p-6">
          <div className="flex items-center gap-2">
            <Database className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Hướng dẫn import</h2>
          </div>
          <div className="mt-5 grid gap-4 text-sm leading-7 text-ink-soft">
            <p>Luôn chạy “Kiểm tra dữ liệu” trước khi import. Phase 6 không overwrite; problem trùng slug sẽ bị bỏ qua.</p>
            <p>PDF/DOCX chưa được parse trực tiếp. Hãy chuyển nội dung đã được phép sử dụng sang JSON hoặc CSV trước.</p>
            <p>Gói dữ liệu nên có manifest.json. Nếu có cả file 00 all-in-one và các file 01-10, hệ thống sẽ ưu tiên file 01-10.</p>
            <p>Topic và source collection trùng tên sẽ được tái sử dụng. Topic mới được tạo bằng slug an toàn.</p>
            <p>Không import nội dung có bản quyền nếu bạn không có quyền sử dụng. Quản trị nên chạy QA và preview trước khi publish.</p>
          </div>
        </section>
      )}
    </div>
  );
}
