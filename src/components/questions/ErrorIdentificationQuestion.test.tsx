import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ErrorIdentificationQuestion } from "@/components/questions/ErrorIdentificationQuestion";
import type { ClientQuestion } from "@/lib/problem-types";

type ErrorValue = {
  part?: string;
  correction?: string;
};

function question(
  options: ClientQuestion["options"],
  id = "error-question",
): ClientQuestion {
  return {
    id,
    type: "ERROR_IDENTIFICATION",
    skillType: "ERROR_IDENTIFICATION",
    difficulty: "C1",
    prompt: "The students was ready today.",
    passage: null,
    options,
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    orderIndex: 0,
    problemTitle: "Contract fixture",
    audioUrl: null,
    sectionType: null,
    triosSentences: null,
    writingRubric: null,
  };
}

const options = [
  { id: "A", text: "The students" },
  { id: "B", text: "was" },
  { id: "C", text: "ready" },
  { id: "D", text: "today" },
];

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

describe("Error Identification learner renderer", () => {
  it("renders four labelled native radios and a separate correction input", () => {
    const html = renderToStaticMarkup(createElement(ErrorIdentificationQuestion, {
      question: question(options),
      value: {},
      onChange: vi.fn(),
    }));

    expect((html.match(/type="radio"/g) ?? [])).toHaveLength(4);
    expect(html).toContain("<fieldset");
    expect(html).toContain("Chọn phần có lỗi");
    expect(html).toContain('name="error-identification-error-question-part"');
    expect(html).toContain("Phần sửa");
    expect(html).toContain('placeholder="Viết dạng đúng"');
    for (const option of options) {
      expect(html).toContain(`aria-label="Phần ${option.id}: ${option.text}"`);
      expect(html).toContain(
        `id="error-identification-error-question-part-${option.id}"`,
      );
      expect(html).toContain(
        `for="error-identification-error-question-part-${option.id}"`,
      );
    }
    expect(html).toContain('id="error-identification-error-question-correction"');
    expect(html).toContain('for="error-identification-error-question-correction"');
  });

  it("submits the selected part and correction as separate fields", () => {
    const onChange = vi.fn();
    const tree = ErrorIdentificationQuestion({
      question: question(options),
      value: { correction: "were" },
      onChange,
    });
    const inputs = elements(
      tree,
      (element) => element.type === "input",
    );
    const radios = inputs.filter((input) => input.props.type === "radio");
    const correction = inputs.find((input) => input.props.type !== "radio");

    expect(radios).toHaveLength(4);
    (radios[1]?.props.onChange as (() => void))();
    expect(onChange).toHaveBeenLastCalledWith("error-question", {
      part: "B",
      correction: "were",
    });

    (correction?.props.onChange as ((event: { target: { value: string } }) => void))({
      target: { value: "had been" },
    });
    expect(onChange).toHaveBeenLastCalledWith("error-question", {
      correction: "had been",
    });
  });

  it("isolates two question instances and preserves part/correction state", () => {
    let answers: Record<string, ErrorValue> = {
      "error-one": { correction: "were" },
      "error-two": {},
    };
    const onChange = (questionId: string, nextValue: ErrorValue) => {
      answers = { ...answers, [questionId]: nextValue };
    };
    const renderPair = () =>
      createElement(
        "div",
        null,
        ErrorIdentificationQuestion({
          question: question(options, "error-one"),
          value: answers["error-one"],
          onChange,
        }),
        ErrorIdentificationQuestion({
          question: question(options, "error-two"),
          value: answers["error-two"],
          onChange,
        }),
      );

    let tree = renderPair();
    let inputs = elements(tree, (element) => element.type === "input");
    let radios = inputs.filter((input) => input.props.type === "radio");
    const labels = elements(tree, (element) => element.type === "label");
    const radioNames = new Set(radios.map((radio) => radio.props.name));
    const controlIds = inputs.map((input) => input.props.id);

    expect(radios).toHaveLength(8);
    expect(radioNames).toEqual(new Set([
      "error-identification-error-one-part",
      "error-identification-error-two-part",
    ]));
    expect(new Set(controlIds).size).toBe(controlIds.length);
    expect(labels.map((label) => label.props.htmlFor)).toEqual(
      expect.arrayContaining(controlIds),
    );

    const firstB = radios.find(
      (radio) => radio.props.id === "error-identification-error-one-part-B",
    );
    (firstB?.props.onChange as (() => void))();
    expect(answers["error-one"]).toEqual({
      part: "B",
      correction: "were",
    });

    tree = renderPair();
    inputs = elements(tree, (element) => element.type === "input");
    radios = inputs.filter((input) => input.props.type === "radio");
    const secondC = radios.find(
      (radio) => radio.props.id === "error-identification-error-two-part-C",
    );
    (secondC?.props.onChange as (() => void))();

    tree = renderPair();
    inputs = elements(tree, (element) => element.type === "input");
    radios = inputs.filter((input) => input.props.type === "radio");
    expect(radios.find(
      (radio) => radio.props.id === "error-identification-error-one-part-B",
    )?.props.checked).toBe(true);
    expect(radios.find(
      (radio) => radio.props.id === "error-identification-error-two-part-C",
    )?.props.checked).toBe(true);

    const firstCorrection = inputs.find(
      (input) =>
        input.props.id === "error-identification-error-one-correction",
    );
    (firstCorrection?.props.onChange as (
      event: { target: { value: string } },
    ) => void)({ target: { value: "had been" } });
    expect(answers["error-one"]).toEqual({
      part: "B",
      correction: "had been",
    });
  });

  it("keeps submitted state visible and ignores disabled control changes", () => {
    const onChange = vi.fn();
    const tree = ErrorIdentificationQuestion({
      question: question(options),
      value: { part: "B", correction: "were" },
      onChange,
      disabled: true,
    });
    const inputs = elements(tree, (element) => element.type === "input");
    const selected = inputs.find(
      (input) =>
        input.props.id === "error-identification-error-question-part-B",
    );
    const correction = inputs.find(
      (input) =>
        input.props.id === "error-identification-error-question-correction",
    );

    expect(inputs.every((input) => input.props.disabled === true)).toBe(true);
    expect(selected?.props.checked).toBe(true);
    expect(correction?.props.value).toBe("were");
    (selected?.props.onChange as (() => void))();
    (correction?.props.onChange as (
      event: { target: { value: string } },
    ) => void)({ target: { value: "changed" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not crash or create invalid part controls for legacy null options", () => {
    const html = renderToStaticMarkup(createElement(ErrorIdentificationQuestion, {
      question: question([]),
      value: {},
      onChange: vi.fn(),
    }));

    expect(html).toContain("chưa có đủ bốn phần A–D");
    expect(html).not.toContain('type="radio"');
    expect(html).toContain('role="status"');
  });
});
