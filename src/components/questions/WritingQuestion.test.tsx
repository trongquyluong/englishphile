import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WritingQuestion } from "@/components/questions/WritingQuestion";
import { checkQuestionAnswer } from "@/lib/answer-checking";
import type { ClientQuestion } from "@/lib/problem-types";

function question(
  id: string,
  writingRubric: ClientQuestion["writingRubric"] = null,
): ClientQuestion {
  return {
    id,
    type: "WRITING_PROMPT",
    skillType: "WRITING",
    difficulty: "C1",
    prompt: "Discuss both views and give your opinion.",
    passage: null,
    options: [],
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    orderIndex: 0,
    problemTitle: "Writing practice",
    audioUrl: null,
    sectionType: null,
    triosSentences: null,
    writingRubric,
    listeningPresentation: null,
  };
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) {
    return null;
  }
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (predicate(element)) return element;
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, predicate);
}

describe("Writing learner question renderer", () => {
  it("uses Vietnamese fixed controls and renders authored text without translating it", () => {
    const html = renderToStaticMarkup(
      <WritingQuestion
        question={question("writing-1", {
          criteria: ["Task response", "Coherence and cohesion"],
        })}
        value={{ essay: "One two three." }}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Luận điểm chính");
    expect(html).toContain("Ý chính 1");
    expect(html).toContain("Ý chính 2");
    expect(html).toContain("Từ vựng dự định dùng");
    expect(html).toContain("Bài viết");
    expect(html).toContain("Viết bài luận tiếng Anh của bạn tại đây...");
    expect(html).toContain(
      "Bài viết hiện có 3 từ. Hãy tự rà soát nội dung trước khi gửi.",
    );
    expect(html).not.toContain("đối chiếu yêu cầu độ dài");
    expect(html).not.toContain("suggestedLength");
    expect(html).not.toContain("220–280");
    expect(html).toContain("Tiêu chí tự rà soát");
    expect(html).toContain("Task response");
    expect(html).toContain("Coherence and cohesion");
    expect(html).not.toContain("Đáp ứng yêu cầu đề bài");
    expect(html).not.toContain("Rubric checklist");
  });

  it("shows the fixed Vietnamese fallback without raw JSON-like output", () => {
    const html = renderToStaticMarkup(
      <WritingQuestion
        question={question("writing-fallback")}
        value={null}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain(
      "Người biên soạn chưa cung cấp bộ tiêu chí chi tiết cho đề này.",
    );
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\brubric\b/i);
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("&quot;rubric&quot;");
  });

  it("keeps the displayed word count informational and outside Writing scoring", () => {
    const shortResult = checkQuestionAnswer(
      { type: "WRITING_PROMPT", answer: null, explanation: null },
      { essay: "One two three." },
    );
    const longResult = checkQuestionAnswer(
      { type: "WRITING_PROMPT", answer: null, explanation: null },
      { essay: "word ".repeat(300).trim() },
    );

    expect(shortResult.isCorrect).toBeNull();
    expect(longResult.isCorrect).toBeNull();
  });

  it("uses matching, question-specific control IDs and labels for multiple instances", () => {
    const html = renderToStaticMarkup(
      <>
        <WritingQuestion
          question={question("writing-a")}
          value={null}
          onChange={() => undefined}
        />
        <WritingQuestion
          question={question("writing-b")}
          value={null}
          onChange={() => undefined}
        />
      </>,
    );

    for (const id of [
      "writing-writing-a-thesis",
      "writing-writing-a-essay",
      "writing-writing-b-thesis",
      "writing-writing-b-essay",
    ]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`for="${id}"`);
    }
    expect(html.match(/id="writing-writing-a-essay"/g)).toHaveLength(1);
    expect(html.match(/id="writing-writing-b-essay"/g)).toHaveLength(1);
  });

  it("fails closed while disabled", () => {
    const onChange = vi.fn();
    const tree = WritingQuestion({
      question: question("writing-disabled"),
      value: { essay: "Keep this response." },
      onChange,
      disabled: true,
    });
    const essay = findElement(
      tree,
      (element) => element.props.id === "writing-writing-disabled-essay",
    );

    expect(essay?.props.disabled).toBe(true);
    const handler = essay?.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    handler?.({ target: { value: "Attempted replacement." } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("preserves every other field when each planning field changes", () => {
    const onChange = vi.fn();
    const initialValue = {
      thesis: "Original thesis",
      mainIdea1: "Original first idea",
      mainIdea2: "Original second idea",
      vocabulary: "Original vocabulary",
      essay: "The learner's complete response.",
    };
    const tree = WritingQuestion({
      question: question("writing-preserve"),
      value: initialValue,
      onChange,
    });

    const planningFields = [
      ["thesis", "thesis"],
      ["mainIdea1", "main-idea-1"],
      ["mainIdea2", "main-idea-2"],
      ["vocabulary", "vocabulary"],
    ] as const;

    for (const [field, idSuffix] of planningFields) {
      const input = findElement(
        tree,
        (element) => element.props.id === `writing-writing-preserve-${idSuffix}`,
      );
      const handler = input?.props.onChange as
        | ((event: { target: { value: string } }) => void)
        | undefined;
      handler?.({ target: { value: `Updated ${field}` } });

      expect(onChange).toHaveBeenLastCalledWith("writing-preserve", {
        ...initialValue,
        [field]: `Updated ${field}`,
      });
    }
    expect(onChange).toHaveBeenCalledTimes(planningFields.length);
  });

  it("preserves every planning field when the essay changes", () => {
    const onChange = vi.fn();
    const initialValue = {
      thesis: "Original thesis",
      mainIdea1: "Original first idea",
      mainIdea2: "Original second idea",
      vocabulary: "Original vocabulary",
      essay: "Original essay.",
    };
    const tree = WritingQuestion({
      question: question("writing-essay-preserve"),
      value: initialValue,
      onChange,
    });
    const essay = findElement(
      tree,
      (element) => element.props.id === "writing-writing-essay-preserve-essay",
    );
    const handler = essay?.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    handler?.({ target: { value: "Updated essay." } });

    expect(onChange).toHaveBeenCalledWith("writing-essay-preserve", {
      ...initialValue,
      essay: "Updated essay.",
    });
  });
});
