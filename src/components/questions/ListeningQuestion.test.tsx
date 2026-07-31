import { renderToStaticMarkup } from "react-dom/server";
import { createElement, Children, ReactNode, ReactElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListeningQuestion } from "@/components/questions/ListeningQuestion";
import type { ClientQuestion } from "@/lib/problem-types";
import type { ListeningPresentationDTO } from "@/lib/questions/listening-contract";

const UNAVAILABLE_NOTICE = "Nội dung nghe chưa sẵn sàng. Bạn chưa thể trả lời câu hỏi này.";

type HostilePresentation = ClientQuestion["listeningPresentation"];

function getBaseMCQ(id = "q-1"): ClientQuestion {
  return {
    id,
    type: "LISTENING_MCQ",
    skillType: "LISTENING",
    difficulty: "C1",
    prompt: "Listen and choose.",
    passage: null,
    options: [
      { id: "A", text: "One" },
      { id: "B", text: "Two" },
      { id: "C", text: "Three" },
      { id: "D", text: "Four" },
    ],
    rootWord: null,
    keyword: null,
    targetSentence: null,
    lineNumber: null,
    orderIndex: 0,
    problemTitle: null,
    audioUrl: null,
    sectionType: null,
    triosSentences: null,
    writingRubric: null,
    listeningPresentation: null,
  };
}

function getBaseShortAnswer(id = "q-1"): ClientQuestion {
  return { ...getBaseMCQ(id), type: "LISTENING_SHORT_ANSWER", options: [] };
}

function hostile<T>(value: T): HostilePresentation {
  return value as unknown as HostilePresentation;
}

function hostileExtra<T>(value: T): Partial<ClientQuestion> {
  return value as unknown as Partial<ClientQuestion>;
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

function expectSafeHtml(html: string) {
  expect(html).toContain(UNAVAILABLE_NOTICE);
  expect(html.match(new RegExp(UNAVAILABLE_NOTICE, "g"))?.length).toBe(1);
  expect(html).not.toContain("<audio");
  expect(html).not.toContain("<source");
  expect(html).not.toContain('src="');
  expect(html).not.toContain('type="radio"');
  expect(html).not.toContain("<input");
  expect(html).not.toContain("<textarea");
  expect(html).not.toContain("transcript");
  expect(html).not.toContain("SENTINEL");
  expect(html).not.toContain("DO_NOT_LEAK");
  expect(html).not.toContain("DELIVERY_NOT_CONFIGURED");
  expect(html).not.toContain("LISTENING_MEDIA_UNAVAILABLE");
  expect(html).not.toContain("RIGHTS_EVIDENCE");
  expect(html).not.toContain("legacy.mp3");
  expect(html).not.toContain("Part 1");
  expect(html).not.toContain("One</span>");
  expect(html).not.toContain("Two</span>");
  expect(html).not.toContain("Three</span>");
  expect(html).not.toContain("Four</span>");
  expect(html).not.toContain("PREVIOUSLY_ENTERED");
}

describe("ListeningQuestion Renderer (PR 3A: unavailable-only)", () => {
  describe("MCQ fail-closed hostile states", () => {
    const cases: Array<{
      name: string;
      pres: HostilePresentation;
      extra?: Partial<ClientQuestion>;
      disabled?: boolean;
    }> = [
      { name: "null presentation", pres: hostile<null>(null) },
      { name: "undefined presentation", pres: hostile<undefined>(undefined) },
      {
        name: "canonical UNAVAILABLE with reason code",
        pres: hostile<ListeningPresentationDTO>({
          state: "UNAVAILABLE",
          reason: "DELIVERY_NOT_CONFIGURED",
          mimeType: "audio/mpeg",
          durationMs: 90000,
          partLabel: null,
          attributionText: "Sentinel attribution",
          transcriptPolicy: "AFTER_SUBMISSION",
          transcript: null,
        }),
      },
      {
        name: "forged READY with sentinel src",
        pres: hostile<unknown>({ state: "READY", src: "/SENTINEL/DO_NOT_LEAK.mp3" }),
      },
      {
        name: "unknown state string with src",
        pres: hostile<unknown>({ state: "SOMETHING_NEW", src: "/x.mp3" }),
      },
      {
        name: "missing state property",
        pres: hostile<unknown>({ src: "/missing-state.mp3" }),
      },
      { name: "empty object", pres: hostile<unknown>({}) },
      { name: "array", pres: hostile<unknown>([]) },
      { name: "string", pres: hostile<unknown>("READY") },
      { name: "number", pres: hostile<unknown>(42) },
      { name: "boolean", pres: hostile<unknown>(true) },
      { name: "legacy audioUrl", pres: hostile(null), extra: { audioUrl: "/legacy.mp3" } },
      { name: "legacy sectionType", pres: hostile(null), extra: { sectionType: "Part 1" } },
      {
        name: "transcript and rights-evidence sentinels",
        pres: hostile<unknown>({
          state: "READY",
          src: "/SENTINEL/DO_NOT_LEAK.mp3",
          transcript: { text: "TRANSCRIPT_SENTINEL", languageTag: "en" },
          rights: { classification: "OWNED", evidenceRef: "RIGHTS_EVIDENCE" },
        }),
      },
      { name: "disabled=false", pres: hostile(null), disabled: false },
      { name: "disabled=true", pres: hostile(null), disabled: true },
      {
        name: "malformed options injected",
        pres: hostile(null),
        extra: hostileExtra({ options: [{ id: "A", text: "Only one" }] }),
      },
    ];

    for (const c of cases) {
      it(`MCQ fails closed for ${c.name}`, () => {
        const question: ClientQuestion = {
          ...getBaseMCQ(),
          listeningPresentation: c.pres,
          ...(c.extra || {}),
        };
        const html = renderToStaticMarkup(
          createElement(ListeningQuestion, {
            question,
            value: "A",
            onChange: vi.fn(),
            disabled: c.disabled,
          }),
        );

        expectSafeHtml(html);
        // Prompt remains visible
        expect(html).toContain("Listen and choose.");

        // Caller value object remains unchanged
        const value: unknown = { sentinel: "VALUE_OBJECT" };
        const original = JSON.stringify(value);
        const onChange = vi.fn();
        const tree = ListeningQuestion({
          question,
          value,
          onChange,
          disabled: c.disabled,
        });
        const inputs = elements(tree, (el) => el.type === "input" || el.type === "textarea");
        const radios = elements(tree, (el) => el.type === "input" && (el.props as { type?: string }).type === "radio");
        expect(inputs).toHaveLength(0);
        expect(radios).toHaveLength(0);
        expect(onChange).not.toHaveBeenCalled();
        expect(JSON.stringify(value)).toBe(original);
      });

      it(`Short Answer fails closed for ${c.name}`, () => {
        const question: ClientQuestion = {
          ...getBaseShortAnswer(),
          listeningPresentation: c.pres,
          ...(c.extra || {}),
        };
        const html = renderToStaticMarkup(
          createElement(ListeningQuestion, {
            question,
            value: "PREVIOUSLY_ENTERED",
            onChange: vi.fn(),
            disabled: c.disabled,
          }),
        );

        expectSafeHtml(html);
        // Previously entered answer value not visible
        expect(html).not.toContain("PREVIOUSLY_ENTERED");
        // Prompt remains visible
        expect(html).toContain("Listen and choose.");

        const value: unknown = "PREVIOUSLY_ENTERED";
        const original = value;
        const onChange = vi.fn();
        const tree = ListeningQuestion({
          question,
          value,
          onChange,
          disabled: c.disabled,
        });
        const inputs = elements(tree, (el) => el.type === "input" || el.type === "textarea");
        expect(inputs).toHaveLength(0);
        expect(onChange).not.toHaveBeenCalled();
        expect(value).toBe(original);
      });
    }
  });

  describe("Accessibility structure", () => {
    it("Status region uses role=status and aria-live=polite", () => {
      const question = getBaseMCQ();
      const html = renderToStaticMarkup(
        createElement(ListeningQuestion, {
          question,
          value: "",
          onChange: vi.fn(),
        }),
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-labelledby="listening-heading-q-1"');
      expect(html).toContain('id="listening-heading-q-1"');
    });

    it("Stable unique IDs across two instances with no duplicates", () => {
      const q1 = getBaseMCQ("q-1");
      const q2 = getBaseMCQ("q-2");

      const html = renderToStaticMarkup(
        createElement("div", null,
          createElement(ListeningQuestion, { question: q1, value: "", onChange: vi.fn() }),
          createElement(ListeningQuestion, { question: q2, value: "", onChange: vi.fn() }),
        ),
      );

      expect(html).toContain('id="listening-heading-q-1"');
      expect(html).toContain('aria-labelledby="listening-heading-q-1"');

      expect(html).toContain('id="listening-heading-q-2"');
      expect(html).toContain('aria-labelledby="listening-heading-q-2"');

      // No duplicate IDs
      const idMatches = html.match(/id="[^"]+"/g) || [];
      expect(idMatches.length).toBe(new Set(idMatches).size);

      // Question prompt remains visible twice
      const matches = html.match(/Listen and choose\./g);
      expect(matches).toHaveLength(2);

      // No focusable hidden controls
      expect(html).not.toContain('type="hidden"');
      expect(html).not.toContain("<input");
      expect(html).not.toContain("<button");
    });

    it("does not use dangerouslySetInnerHTML", () => {
      const question = getBaseMCQ();
      const html = renderToStaticMarkup(
        createElement(ListeningQuestion, {
          question,
          value: "",
          onChange: vi.fn(),
        }),
      );
      expect(html).not.toContain("dangerouslySetInnerHTML");
    });
  });

  describe("Submitted/reviewed fixtures remain safe", () => {
    it("MCQ with selected answer value still fails closed", () => {
      const question: ClientQuestion = {
        ...getBaseMCQ(),
        listeningPresentation: hostile<unknown>({ state: "READY", src: "/SENTINEL/DO_NOT_LEAK.mp3" }),
      };
      const html = renderToStaticMarkup(
        createElement(ListeningQuestion, {
          question,
          value: "A",
          onChange: vi.fn(),
          disabled: true,
        }),
      );
      expectSafeHtml(html);
    });

    it("Short Answer with previously entered value still fails closed", () => {
      const question: ClientQuestion = {
        ...getBaseShortAnswer(),
        listeningPresentation: hostile<unknown>({ state: "READY", src: "/SENTINEL/DO_NOT_LEAK.mp3" }),
      };
      const html = renderToStaticMarkup(
        createElement(ListeningQuestion, {
          question,
          value: "PREVIOUSLY_ENTERED",
          onChange: vi.fn(),
          disabled: true,
        }),
      );
      expectSafeHtml(html);
      expect(html).not.toContain("PREVIOUSLY_ENTERED");
    });
  });
});
