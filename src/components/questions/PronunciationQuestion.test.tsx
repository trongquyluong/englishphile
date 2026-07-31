import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PronunciationQuestion } from "@/components/questions/PronunciationQuestion";
import type { ClientQuestion } from "@/lib/problem-types";

const options = [
  { id: "D", text: "team", targetSpan: { start: 1, end: 3 } },
  { id: "B", text: "leaf", targetSpan: { start: 1, end: 3 } },
  { id: "A", text: "seat", targetSpan: { start: 1, end: 3 } },
  { id: "C", text: "bread", targetSpan: { start: 2, end: 4 } },
];

function question(
  id = "pronunciation-question",
  questionOptions: ClientQuestion["options"] = options,
): ClientQuestion {
  return {
    id,
    type: "PRONUNCIATION_ODD_ONE_OUT",
    skillType: "PRONUNCIATION",
    difficulty: "C1",
    prompt: "Chọn từ khác.",
    passage: null,
    options: questionOptions,
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    orderIndex: 0,
    problemTitle: "Pronunciation contract",
    audioUrl: null,
    sectionType: null,
    triosSentences: null,
    writingRubric: null,
    listeningPresentation: null,
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

function visibleText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement<Record<string, unknown>>(node)) return "";
  return Children.toArray(node.props.children as ReactNode)
    .map(visibleText)
    .join("");
}

describe("Pronunciation learner renderer (structural/static evidence)", () => {
  it("renders the instruction and exactly four ordered native radio choices", () => {
    const html = renderToStaticMarkup(createElement(PronunciationQuestion, {
      question: question(),
      value: "",
      onChange: vi.fn(),
    }));

    expect(html).toContain("Chọn từ có phần gạch chân phát âm khác");
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect((html.match(/type="radio"/g) ?? [])).toHaveLength(4);
    expect(html.indexOf(">A.</")).toBeLessThan(html.indexOf(">B.</"));
    expect(html.indexOf(">B.</")).toBeLessThan(html.indexOf(">C.</"));
    expect(html.indexOf(">C.</")).toBeLessThan(html.indexOf(">D.</"));
  });

  it("preserves prefix/target/suffix and underlines only the validated target", () => {
    const tree = PronunciationQuestion({
      question: question(),
      value: "",
      onChange: vi.fn(),
    });
    const labels = elements(tree, (element) => element.type === "label");
    const bread = labels.find((label) =>
      String(label.props["aria-label"]).includes("bread"),
    );
    const underlined = elements(
      bread,
      (element) =>
        element.type === "span" &&
        String(element.props.className ?? "").includes("underline"),
    );

    expect(visibleText(bread).replace("C. ", "")).toBe("bread");
    expect(underlined).toHaveLength(1);
    expect(visibleText(underlined[0])).toBe("ea");
    expect(String(bread?.props["aria-label"])).toBe(
      "Lựa chọn C: bread. Phần gạch chân: ea.",
    );
  });

  it("uses the same Unicode code-point slicing model for surrogate pairs", () => {
    const unicodeOptions = [
      { id: "A", text: "😀éx", targetSpan: { start: 1, end: 2 } },
      ...options.filter((option) => option.id !== "A"),
    ];
    const tree = PronunciationQuestion({
      question: question("unicode", unicodeOptions),
      value: "",
      onChange: vi.fn(),
    });
    const label = elements(tree, (element) => element.type === "label")
      .find((candidate) => candidate.props.htmlFor === "pronunciation-unicode-A");
    const underlined = elements(
      label,
      (element) =>
        element.type === "span" &&
        String(element.props.className ?? "").includes("underline"),
    );

    expect(visibleText(label).replace("A. ", "")).toBe("😀éx");
    expect(visibleText(underlined[0])).toBe("é");
  });

  it("submits the existing string answer shape and preserves checked state", () => {
    const onChange = vi.fn();
    const tree = PronunciationQuestion({
      question: question("change"),
      value: "B",
      onChange,
    });
    const radios = elements(
      tree,
      (element) => element.type === "input" && element.props.type === "radio",
    );
    const selected = radios.find((radio) => radio.props.value === "B");
    const next = radios.find((radio) => radio.props.value === "C");

    expect(selected?.props.checked).toBe(true);
    (next?.props.onChange as (() => void))();
    expect(onChange).toHaveBeenCalledWith("change", "C");
  });

  it("uses unique names/IDs, matching labels, and independent state", () => {
    let answers: Record<string, string> = { one: "A", two: "D" };
    const onChange = (questionId: string, value: string) => {
      answers = { ...answers, [questionId]: value };
    };
    const renderPair = () =>
      createElement(
        "div",
        null,
        PronunciationQuestion({
          question: question("one"),
          value: answers.one,
          onChange,
        }),
        PronunciationQuestion({
          question: question("two"),
          value: answers.two,
          onChange,
        }),
      );
    let tree = renderPair();
    let radios = elements(
      tree,
      (element) => element.type === "input" && element.props.type === "radio",
    );
    const labels = elements(tree, (element) => element.type === "label");

    expect(radios).toHaveLength(8);
    expect(new Set(radios.map((radio) => radio.props.name))).toEqual(
      new Set(["pronunciation-one", "pronunciation-two"]),
    );
    expect(new Set(radios.map((radio) => radio.props.id)).size).toBe(8);
    expect(labels.map((label) => label.props.htmlFor)).toEqual(
      expect.arrayContaining(radios.map((radio) => radio.props.id)),
    );

    const secondB = radios.find(
      (radio) => radio.props.id === "pronunciation-two-B",
    );
    (secondB?.props.onChange as (() => void))();
    tree = renderPair();
    radios = elements(
      tree,
      (element) => element.type === "input" && element.props.type === "radio",
    );
    expect(radios.find(
      (radio) => radio.props.id === "pronunciation-one-A",
    )?.props.checked).toBe(true);
    expect(radios.find(
      (radio) => radio.props.id === "pronunciation-two-B",
    )?.props.checked).toBe(true);
  });

  it("keeps reviewed/submitted state disabled and fails closed on direct handlers", () => {
    const onChange = vi.fn();
    const tree = PronunciationQuestion({
      question: question("submitted"),
      value: "C",
      onChange,
      disabled: true,
    });
    const radios = elements(
      tree,
      (element) => element.type === "input" && element.props.type === "radio",
    );
    const selected = radios.find((radio) => radio.props.value === "C");

    expect(radios.every((radio) => radio.props.disabled === true)).toBe(true);
    expect(selected?.props.checked).toBe(true);
    (selected?.props.onChange as (() => void))();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["missing spans", options.map(({ id, text }) => ({ id, text }))],
    ["malformed span", [
      { ...options[0], targetSpan: { start: 2, end: 2 } },
      ...options.slice(1),
    ]],
    ["partial options", options.slice(0, 3)],
  ])("fails closed for %s without partial controls or disclosure", (_name, malformedOptions) => {
    const sentinel = "RAW_ANSWER_METADATA_SENTINEL";
    const unsafeQuestion = {
      ...question("malformed", malformedOptions),
      answer: { correctOptionId: "C", sentinel },
      metadata: { focus: sentinel },
      rawOptions: [{ text: sentinel }],
    } as ClientQuestion & Record<string, unknown>;
    const html = renderToStaticMarkup(createElement(PronunciationQuestion, {
      question: unsafeQuestion,
      value: sentinel,
      onChange: vi.fn(),
    }));

    expect(html).toContain("chưa có đủ dữ liệu gạch chân hợp lệ");
    expect(html).toContain('role="status"');
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain(sentinel);
    expect(html).not.toContain("metadata");
    expect(html).not.toContain("correctOptionId");
  });
});
