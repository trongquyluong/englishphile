import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TriosQuestion } from "@/components/questions/TriosQuestion";
import type { ClientQuestion } from "@/lib/problem-types";
import type { TriosSentences } from "@/lib/questions/trios-contract";

const sentences: TriosSentences = [
  "The committee reached a _____ after two hours.",
  "Her silence led me to the wrong _____.",
  "The evidence points to one _____.",
];

function question(
  id = "trios-question",
  triosSentences: TriosSentences | null = sentences,
): ClientQuestion {
  return {
    id,
    type: "TRIOS_GAPPED_SENTENCES",
    skillType: "TRIOS",
    difficulty: "C1",
    prompt: "Điền một từ duy nhất phù hợp với cả ba câu.",
    passage: "metadata.sharedWord: must-not-render",
    options: [],
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    orderIndex: 0,
    problemTitle: "Trios contract",
    audioUrl: null,
    sectionType: null,
    triosSentences,
  };
}

function elements(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): Array<ReactElement<Record<string, unknown>>> {
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  const current = predicate(node) ? [node] : [];
  return [
    ...current,
    ...Children.toArray(node.props.children as ReactNode).flatMap((child) =>
      elements(child, predicate),
    ),
  ];
}

describe("Trios learner renderer", () => {
  it("renders exactly three ordered sentences and one labelled native input", () => {
    const html = renderToStaticMarkup(createElement(TriosQuestion, {
      question: question(),
      value: "",
      onChange: vi.fn(),
    }));

    expect((html.match(/<li/g) ?? [])).toHaveLength(3);
    expect((html.match(/<input/g) ?? [])).toHaveLength(1);
    expect(html.indexOf(sentences[0])).toBeLessThan(html.indexOf(sentences[1]));
    expect(html.indexOf(sentences[1])).toBeLessThan(html.indexOf(sentences[2]));
    expect(html).toContain('id="trios-trios-question-shared-word"');
    expect(html).toContain('for="trios-trios-question-shared-word"');
    expect(html).toContain("<ol");
    expect(html).toContain("Từ chung cho cả ba câu");
  });

  it("uses unique IDs and independent values across two instances", () => {
    const tree = createElement(
      "div",
      null,
      TriosQuestion({
        question: question("trios-one"),
        value: "first",
        onChange: vi.fn(),
      }),
      TriosQuestion({
        question: question("trios-two"),
        value: "second",
        onChange: vi.fn(),
      }),
    );
    const inputs = elements(tree, (element) => element.type === "input");
    const labels = elements(tree, (element) => element.type === "label");

    expect(inputs).toHaveLength(2);
    expect(new Set(inputs.map((input) => input.props.id)).size).toBe(2);
    expect(inputs.map((input) => input.props.value)).toEqual(["first", "second"]);
    expect(labels.map((label) => label.props.htmlFor)).toEqual(
      inputs.map((input) => input.props.id),
    );
  });

  it("submits the existing string shape with the question-specific ID", () => {
    const onChange = vi.fn();
    const tree = TriosQuestion({
      question: question("trios-change"),
      value: "old",
      onChange,
    });
    const input = elements(tree, (element) => element.type === "input")[0];

    (input?.props.onChange as (
      event: { target: { value: string } },
    ) => void)({ target: { value: "conclusion" } });
    expect(onChange).toHaveBeenCalledWith("trios-change", "conclusion");
  });

  it("preserves submitted value and fails closed if a disabled handler is invoked", () => {
    const onChange = vi.fn();
    const tree = TriosQuestion({
      question: question(),
      value: "conclusion",
      onChange,
      disabled: true,
    });
    const input = elements(tree, (element) => element.type === "input")[0];

    expect(input?.props.disabled).toBe(true);
    expect(input?.props.value).toBe("conclusion");
    (input?.props.onChange as (
      event: { target: { value: string } },
    ) => void)({ target: { value: "changed" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a Vietnamese review notice and no guessing input for a null tuple", () => {
    const html = renderToStaticMarkup(createElement(TriosQuestion, {
      question: question("malformed", null),
      value: "historical value",
      onChange: vi.fn(),
    }));

    expect(html).toContain("chưa có đủ ba câu hợp lệ để hiển thị");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain("metadata.sharedWord");
    expect(html).not.toContain("must-not-render");
    expect(html).not.toContain("historical value");
  });
});
