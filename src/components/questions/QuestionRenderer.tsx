"use client";

import type { AnswerMap, ClientProblem } from "@/lib/problem-types";
import { ErrorIdentificationQuestion } from "@/components/questions/ErrorIdentificationQuestion";
import { GuidedClozeQuestion } from "@/components/questions/GuidedClozeQuestion";
import { ListeningQuestion } from "@/components/questions/ListeningQuestion";
import { MultipleChoiceQuestion } from "@/components/questions/MultipleChoiceQuestion";
import { OpenClozeQuestion } from "@/components/questions/OpenClozeQuestion";
import { PronunciationQuestion } from "@/components/questions/PronunciationQuestion";
import { ReadingQuestion } from "@/components/questions/ReadingQuestion";
import { SentenceTransformationQuestion } from "@/components/questions/SentenceTransformationQuestion";
import { TriosQuestion } from "@/components/questions/TriosQuestion";
import { WordFormationQuestion } from "@/components/questions/WordFormationQuestion";
import { WritingQuestion } from "@/components/questions/WritingQuestion";

type Props = {
  problem: ClientProblem;
  answers: AnswerMap;
  onChange: (questionId: string, value: unknown) => void;
  disabled?: boolean;
};

export function QuestionRenderer({ problem, answers, onChange, disabled }: Props) {
  const questions = [...problem.questions].sort((a, b) => a.orderIndex - b.orderIndex);

  if (problem.questionType === "GUIDED_CLOZE") {
    return <GuidedClozeQuestion questions={questions} answers={answers} onChange={onChange} disabled={disabled} />;
  }

  if (problem.questionType === "OPEN_CLOZE") {
    return <OpenClozeQuestion questions={questions} answers={answers} onChange={onChange} disabled={disabled} />;
  }

  if (problem.questionType === "READING_MCQ") {
    return <ReadingQuestion questions={questions} answers={answers} onChange={onChange} disabled={disabled} />;
  }

  return (
    <div className="grid gap-6">
      {questions.map((question) => {
        if (question.type === "PRONUNCIATION_ODD_ONE_OUT") {
          return (
            <PronunciationQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "WORD_FORMATION") {
          return (
            <WordFormationQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "SENTENCE_TRANSFORMATION") {
          return (
            <SentenceTransformationQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "ERROR_IDENTIFICATION") {
          return (
            <ErrorIdentificationQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "TRIOS_GAPPED_SENTENCES") {
          return (
            <TriosQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "WRITING_PROMPT") {
          return (
            <WritingQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        if (question.type === "LISTENING_MCQ" || question.type === "LISTENING_SHORT_ANSWER") {
          return (
            <ListeningQuestion
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onChange}
              disabled={disabled}
            />
          );
        }

        return (
          <MultipleChoiceQuestion
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={onChange}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}
