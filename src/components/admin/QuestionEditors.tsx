import type { ContentStatus, Difficulty, QuestionType, SkillType } from "@prisma/client";
import type { ReactNode } from "react";
import { contentStatusLabels, contentStatusOrder, difficultyLabels, difficultyOrder, questionTypeLabels, skillLabels, skillOrder } from "@/lib/labels";

export type AdminQuestionEditorQuestion = {
  id: string;
  type: QuestionType;
  skillType: SkillType;
  difficulty: Difficulty;
  prompt: string;
  passage: string | null;
  options: unknown;
  answer: unknown;
  explanation: string | null;
  rootWord: string | null;
  keyword: string | null;
  targetSentence: string | null;
  lineNumber: number | null;
  metadata: unknown;
  orderIndex: number;
  contentStatus: ContentStatus;
};

function jsonText(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function Field({
  label,
  children,
  span = false,
}: {
  label: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium ${span ? "md:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function inputClass() {
  return "min-h-10 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2";
}

function textareaClass(mono = false) {
  return `min-h-24 rounded-md bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2 ${mono ? "font-mono text-xs" : ""}`;
}

export function AdminQuestionEditor({ question, title }: { question: AdminQuestionEditorQuestion; title: string }) {
  const prefix = `question_${question.id}`;

  return (
    <article className="rounded-lg bg-panel-muted p-4">
      <input type="hidden" name="questionId" value={question.id} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-ink-soft">{question.id}</p>
        </div>
        <Field label="Thứ tự">
          <input name={`${prefix}_orderIndex`} type="number" defaultValue={question.orderIndex} className={`${inputClass()} w-24`} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Question type">
          <select name={`${prefix}_type`} defaultValue={question.type} className={inputClass()}>
            {Object.entries(questionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Content status">
          <select name={`${prefix}_contentStatus`} defaultValue={question.contentStatus} className={inputClass()}>
            {contentStatusOrder.map((status) => (
              <option key={status} value={status}>
                {contentStatusLabels[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Skill">
          <select name={`${prefix}_skillType`} defaultValue={question.skillType} className={inputClass()}>
            {skillOrder.map((skill) => (
              <option key={skill} value={skill}>
                {skillLabels[skill]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Độ khó">
          <select name={`${prefix}_difficulty`} defaultValue={question.difficulty} className={inputClass()}>
            {difficultyOrder.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficultyLabels[difficulty]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prompt" span>
          <textarea name={`${prefix}_prompt`} defaultValue={question.prompt} className={textareaClass()} />
        </Field>

        <Field label="Passage" span>
          <textarea name={`${prefix}_passage`} defaultValue={question.passage ?? ""} className={textareaClass()} />
        </Field>

        <Field label="Options JSON">
          <textarea name={`${prefix}_options`} defaultValue={jsonText(question.options)} className={textareaClass(true)} />
        </Field>

        <Field label="Answer JSON">
          <textarea name={`${prefix}_answer`} defaultValue={jsonText(question.answer)} className={textareaClass(true)} />
        </Field>

        <Field label="Explanation" span>
          <textarea name={`${prefix}_explanation`} defaultValue={question.explanation ?? ""} className={textareaClass()} />
        </Field>

        <Field label="Root word">
          <input name={`${prefix}_rootWord`} defaultValue={question.rootWord ?? ""} className={inputClass()} />
        </Field>

        <Field label="Keyword">
          <input name={`${prefix}_keyword`} defaultValue={question.keyword ?? ""} className={inputClass()} />
        </Field>

        <Field label="Target sentence" span>
          <textarea name={`${prefix}_targetSentence`} defaultValue={question.targetSentence ?? ""} className={textareaClass()} />
        </Field>

        <Field label="Line number">
          <input name={`${prefix}_lineNumber`} type="number" defaultValue={question.lineNumber ?? ""} className={inputClass()} />
        </Field>

        <Field label="Metadata JSON">
          <textarea name={`${prefix}_metadata`} defaultValue={jsonText(question.metadata)} className={textareaClass(true)} />
        </Field>
      </div>
    </article>
  );
}

export function MCQQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="MCQ" />;
}

export function PronunciationQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Pronunciation" />;
}

export function WordFormationQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Word Formation" />;
}

export function SentenceTransformationQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Sentence Transformation" />;
}

export function GuidedClozeQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Guided Cloze" />;
}

export function OpenClozeQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Open Cloze" />;
}

export function ErrorIdentificationQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Error Identification" />;
}

export function TriosQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Trios / Gapped Sentences" />;
}

export function ReadingQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Reading MCQ" />;
}

export function WritingQuestionEditor({ question }: { question: AdminQuestionEditorQuestion }) {
  return <AdminQuestionEditor question={question} title="Writing Prompt" />;
}

export function QuestionEditorSwitch({ question }: { question: AdminQuestionEditorQuestion }) {
  if (question.type === "PRONUNCIATION_ODD_ONE_OUT") return <PronunciationQuestionEditor question={question} />;
  if (question.type === "WORD_FORMATION") return <WordFormationQuestionEditor question={question} />;
  if (question.type === "SENTENCE_TRANSFORMATION") return <SentenceTransformationQuestionEditor question={question} />;
  if (question.type === "GUIDED_CLOZE") return <GuidedClozeQuestionEditor question={question} />;
  if (question.type === "OPEN_CLOZE") return <OpenClozeQuestionEditor question={question} />;
  if (question.type === "ERROR_IDENTIFICATION") return <ErrorIdentificationQuestionEditor question={question} />;
  if (question.type === "TRIOS_GAPPED_SENTENCES") return <TriosQuestionEditor question={question} />;
  if (question.type === "READING_MCQ") return <ReadingQuestionEditor question={question} />;
  if (question.type === "WRITING_PROMPT") return <WritingQuestionEditor question={question} />;
  return <MCQQuestionEditor question={question} />;
}
