import type { QuestionType } from "@prisma/client";
import { cn } from "@/lib/utils";

type RootWordQuestion = {
  type: QuestionType;
  prompt: string;
  rootWord: string | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeRootWord(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function promptAlreadyShowsRootWord(prompt: string, rootWord: string) {
  const normalizedRoot = normalizeRootWord(rootWord);
  if (!normalizedRoot) return false;
  return new RegExp(`\\(\\s*${escapeRegExp(normalizedRoot)}\\s*\\)`, "i").test(prompt);
}

export function getVisibleRootWord(question: RootWordQuestion) {
  const rootWord = normalizeRootWord(question.rootWord);
  if (question.type !== "WORD_FORMATION" || !rootWord) return null;
  if (promptAlreadyShowsRootWord(question.prompt, rootWord)) return null;
  return rootWord;
}

type Props = {
  question: RootWordQuestion;
  className?: string;
};

export function QuestionRootWord({ question, className }: Props) {
  const rootWord = getVisibleRootWord(question);
  if (!rootWord) return null;

  return (
    <span className={cn("inline-flex w-fit rounded-full bg-accent-soft/60 px-2.5 py-1 text-xs font-semibold text-accent-strong", className)}>
      Từ gốc: {rootWord}
    </span>
  );
}
