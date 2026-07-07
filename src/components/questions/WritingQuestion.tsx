"use client";

import type { ClientQuestion } from "@/lib/problem-types";
import { getAnswerNote } from "@/components/questions/question-utils";

type WritingValue = {
  thesis?: string;
  mainIdea1?: string;
  mainIdea2?: string;
  vocabulary?: string;
  essay?: string;
};

type Props = {
  question: ClientQuestion;
  value: unknown;
  onChange: (questionId: string, value: WritingValue) => void;
  disabled?: boolean;
};

export function WritingQuestion({ question, value, onChange, disabled }: Props) {
  const current = (value && typeof value === "object" ? value : {}) as WritingValue;
  const note = getAnswerNote(question.answer);
  const update = (patch: Partial<WritingValue>) => onChange(question.id, { ...current, ...patch });

  return (
    <div className="grid gap-4">
      <article className="rounded-lg bg-panel-muted p-4 text-sm leading-7">{question.prompt}</article>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Thesis
          <input value={current.thesis ?? ""} disabled={disabled} onChange={(event) => update({ thesis: event.target.value })} className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)]" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Main idea 1
          <input value={current.mainIdea1 ?? ""} disabled={disabled} onChange={(event) => update({ mainIdea1: event.target.value })} className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)]" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Main idea 2
          <input value={current.mainIdea2 ?? ""} disabled={disabled} onChange={(event) => update({ mainIdea2: event.target.value })} className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)]" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Useful vocabulary
          <input value={current.vocabulary ?? ""} disabled={disabled} onChange={(event) => update({ vocabulary: event.target.value })} className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)]" />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Essay
        <textarea
          value={current.essay ?? ""}
          disabled={disabled}
          onChange={(event) => update({ essay: event.target.value })}
          className="min-h-56 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
          placeholder="Viết bài luận ở đây"
        />
      </label>
      <div className="rounded-lg bg-white p-4 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.12)]">
        <p className="text-sm font-semibold">Rubric checklist</p>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          {(note?.rubric.length ? note.rubric : ["Task response", "Coherence", "Lexical resource", "Grammar range and accuracy", "Academic sophistication"]).map((item) => (
            <li key={item}>□ {item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
