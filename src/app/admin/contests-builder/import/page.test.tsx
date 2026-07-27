import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContestImportView,
  processContestFileSelection,
  type ParseState,
} from "@/app/admin/contests-builder/import/page";
import { RAW_FORMULA_SENTINEL } from "@/lib/import/test-fixtures/synthetic-contest-workbook";

const boundaries = vi.hoisted(() => ({
  importContest: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>
  ),
}));
vi.mock("@/app/admin/contests-builder/actions", () => ({
  importContestFromParsedAction: boundaries.importContest,
}));

const formulaResponse = {
  data: null,
  errors: [{
    sheet: "Contest_Info",
    row: 2,
    field: "B2",
    code: "FORMULA_NOT_ALLOWED",
    message: "Ô B2 chứa công thức Excel.",
  }],
  warnings: [],
};

const validResponse = {
  data: {
    info: {
      title: "Synthetic contest preview",
      description: null,
      visibility: "PUBLIC",
      accessCode: null,
      startAt: null,
      endAt: null,
      durationMinutes: 120,
    },
    sections: [{
      sectionId: "section-1",
      orderIndex: 1,
      sectionType: "UOE_MCQ",
      title: "Synthetic section",
      instructions: null,
      questionCount: 1,
      totalPoints: 1,
      audioUrl: null,
      transcriptAdminOnly: null,
      passageText: null,
      essayType: null,
      targetWordCount: null,
      notes: null,
    }],
    questions: [{
      sectionId: "section-1",
      questionId: "question-1",
      orderIndex: 1,
      questionType: "MCQ",
      prompt: "Synthetic prompt",
      optionA: "A",
      optionB: "B",
      optionC: "C",
      optionD: "D",
      correctAnswer: "A",
      acceptedAnswers: null,
      rootWord: null,
      points: 1,
      explanation: null,
      notes: null,
    }],
  },
  errors: [],
  warnings: [],
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

type FileSelectionEvent = Parameters<typeof processContestFileSelection>[0];

function fileSelectionEvent(file: File): FileSelectionEvent {
  return { target: { files: [file] } } as unknown as FileSelectionEvent;
}

function renderState(state: ParseState): string {
  return renderToStaticMarkup(
    <ContestImportView
      state={state}
      isImporting={false}
      selectedFile={new File(["synthetic"], "synthetic.xlsx")}
      fileInputRef={createRef<HTMLInputElement>()}
      onFileChange={vi.fn()}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      onEditFile={vi.fn()}
    />,
  );
}

describe("contest spreadsheet import page formula handling (production UI/component runtime)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bounded Vietnamese validation through the real upload transition without throwing", async () => {
    const states: ParseState[] = [];
    const selectedFiles: File[] = [];
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(formulaResponse));
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "formula.xlsx");

    await processContestFileSelection(
      fileSelectionEvent(file),
      {
        fetcher,
        setSelectedFile: (selected) => selectedFiles.push(selected),
        setParseState: (state) => states.push(state),
      },
    );

    expect(selectedFiles).toEqual([file]);
    expect(states[0]).toEqual({ status: "parsing" });
    expect(states.at(-1)).toEqual({
      status: "validation",
      errors: [{
        sheet: "Contest_Info",
        row: 2,
        field: "B2",
        code: "FORMULA_NOT_ALLOWED",
        message: "File Excel chứa công thức không được phép. Hãy chuyển công thức thành giá trị tĩnh rồi upload lại.",
      }],
      warnings: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/admin/contests-import/parse");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: expect.any(FormData) });

    const validationState = states.at(-1) as ParseState;
    expect(() => renderState(validationState)).not.toThrow();
    const html = renderState(validationState);
    expect(html).toContain("File Excel chưa hợp lệ");
    expect(html).toContain("File Excel chứa công thức không được phép");
    expect(html).not.toContain("Có lỗi khi tải trang");
    expect(html).not.toContain("Tạo contest draft</button>");
    expect(html).not.toContain(RAW_FORMULA_SENTINEL);
    expect(boundaries.importContest).not.toHaveBeenCalled();
  });

  it("recovers from validation when a subsequent valid workbook returns a preview", async () => {
    const states: ParseState[] = [];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(formulaResponse))
      .mockResolvedValueOnce(jsonResponse(validResponse));
    const dependencies = {
      fetcher,
      setSelectedFile: vi.fn(),
      setParseState: (state: ParseState) => states.push(state),
    };

    await processContestFileSelection(
      fileSelectionEvent(new File(["formula"], "formula.xlsx")),
      dependencies,
    );
    await processContestFileSelection(
      fileSelectionEvent(new File(["valid"], "valid.xlsx")),
      dependencies,
    );

    expect(states.some((state) => state.status === "validation")).toBe(true);
    const recovered = states.at(-1);
    expect(recovered).toMatchObject({
      status: "preview",
      data: { info: { title: "Synthetic contest preview" } },
    });

    const html = renderState(recovered as ParseState);
    expect(html).toContain("Synthetic contest preview");
    expect(html).toContain("Tạo contest draft");
    expect(html).not.toContain("Có lỗi khi tải trang");
    expect(boundaries.importContest).not.toHaveBeenCalled();
  });

  it("keeps an unexpected endpoint failure generic and fail-closed", async () => {
    const states: ParseState[] = [];
    const rawFailure = "RAW_INTERNAL_FAILURE_MUST_NOT_RENDER";
    const fetcher = vi.fn().mockRejectedValue(new Error(rawFailure));

    await processContestFileSelection(
      fileSelectionEvent(new File(["synthetic"], "unexpected.xlsx")),
      {
        fetcher,
        setSelectedFile: vi.fn(),
        setParseState: (state) => states.push(state),
      },
    );

    const failed = states.at(-1);
    expect(failed).toEqual({
      status: "error",
      message: "Không thể phân tích file Excel. Vui lòng kiểm tra file và thử lại.",
    });
    const html = renderState(failed as ParseState);
    expect(html).not.toContain(rawFailure);
    expect(html).not.toContain("Tạo contest draft</button>");
    expect(boundaries.importContest).not.toHaveBeenCalled();
  });
});
