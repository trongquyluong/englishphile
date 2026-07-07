import type { Difficulty, SkillType } from "@prisma/client";
import { randomInt } from "crypto";
import Link from "next/link";
import { PracticeClient } from "@/components/practice/PracticeClient";
import { requireUser } from "@/lib/auth/session";
import { difficultyLabels, difficultyOrder, skillLabels, skillOrder } from "@/lib/labels";
import type { ClientQuestion } from "@/lib/problem-types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function values(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function shuffleWithCrypto<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export default async function RandomPracticePage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const started = params.start === "1";
  const selectedSkills = values(params, "skill").filter((skill): skill is SkillType =>
    skillOrder.includes(skill as SkillType),
  );
  const selectedDifficulties = values(params, "difficulty").filter((difficulty): difficulty is Difficulty =>
    difficultyOrder.includes(difficulty as Difficulty),
  );
  const count = Number(params.count ?? 5);
  const take = [5, 10, 20].includes(count) ? count : 5;

  if (!started) {
    return (
      <section className="mx-auto grid w-full max-w-3xl gap-5">
        <div>
          <p className="text-sm font-semibold text-accent">Random practice</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tạo phiên luyện ngẫu nhiên</h1>
          <p className="mt-2 text-sm text-ink-soft">Chọn skill, độ khó và số câu. Wrong-question toggle là placeholder cho phase sau.</p>
        </div>
        <form className="surface grid gap-5 rounded-lg p-5">
          <input type="hidden" name="start" value="1" />
          <div>
            <p className="text-sm font-semibold">Skill types</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {skillOrder.map((skill) => (
                <label key={skill} className="flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                  <input type="checkbox" name="skill" value={skill} className="accent-[var(--accent)]" />
                  {skillLabels[skill]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Difficulty</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {difficultyOrder.map((difficulty) => (
                <label key={difficulty} className="flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.1)]">
                  <input type="checkbox" name="difficulty" value={difficulty} className="accent-[var(--accent)]" />
                  {difficultyLabels[difficulty]}
                </label>
              ))}
            </div>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Số câu
            <select name="count" defaultValue="5" className="min-h-11 rounded-md bg-white px-3 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)]">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="includeWrong" value="1" disabled className="accent-[var(--accent)]" />
            Include wrong questions (placeholder)
          </label>
          <button className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background" type="submit">
            Bắt đầu
          </button>
        </form>
      </section>
    );
  }

  const questions = await prisma.question.findMany({
    where: {
      contentStatus: "PUBLISHED",
      problem: { contentStatus: "PUBLISHED" },
      ...(selectedSkills.length ? { skillType: { in: selectedSkills } } : {}),
      ...(selectedDifficulties.length ? { difficulty: { in: selectedDifficulties } } : {}),
    },
  });

  const randomQuestions = shuffleWithCrypto(questions)
    .slice(0, take)
    .map(
      (question): ClientQuestion => ({
        id: question.id,
        type: question.type,
        skillType: question.skillType,
        difficulty: question.difficulty,
        prompt: question.prompt,
        passage: question.passage,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        rootWord: question.rootWord,
        keyword: question.keyword,
        targetSentence: question.targetSentence,
        lineNumber: question.lineNumber,
        metadata: question.metadata,
        orderIndex: question.orderIndex,
      }),
    );

  if (!randomQuestions.length) {
    return (
      <div className="surface rounded-lg p-6">
        <h1 className="text-2xl font-semibold">Không có câu phù hợp</h1>
        <p className="mt-2 text-sm text-ink-soft">Hãy chọn ít bộ lọc hơn.</p>
        <Link href="/practice/random" className="mt-5 inline-flex min-h-10 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">
          Chọn lại
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Random practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{randomQuestions.length} câu ngẫu nhiên</h1>
      </div>
      <PracticeClient questions={randomQuestions} />
    </div>
  );
}
