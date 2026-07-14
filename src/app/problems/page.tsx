import type { Difficulty, Prisma, ProblemStatus, SkillType } from "@prisma/client";
import { EmptyState } from "@/components/common/EmptyState";
import { ProblemFilters } from "@/components/problems/ProblemFilters";
import { ProblemTable } from "@/components/problems/ProblemTable";
import { getCurrentUser, isContentAdminUser } from "@/lib/auth/session";
import { difficultyOrder, skillOrder } from "@/lib/labels";
import type { ProblemListItem } from "@/lib/problem-types";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function ProblemsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const q = getParam(params, "q");
  const skill = getParam(params, "skill");
  const mode = getParam(params, "mode");
  const difficulty = getParam(params, "difficulty");
  const topic = getParam(params, "topic");
  const statusFilter = getParam(params, "status") as ProblemStatus | undefined;
  const source = getParam(params, "source");
  const personalized = getParam(params, "personalized");
  const includeDrafts = getParam(params, "includeDrafts") === "1";
  const canManageContent = isContentAdminUser(user);

  const where: Prisma.ProblemWhereInput = canManageContent && includeDrafts ? {} : { contentStatus: "PUBLISHED" };

  if (mode === "reading") {
    where.skillType = "READING";
  } else if (mode === "writing") {
    where.skillType = "WRITING";
  } else if (mode === "listening") {
    where.skillType = "LISTENING";
  } else if (mode === "use-of-english") {
    where.skillType = {
      in: [
        "PRONUNCIATION",
        "MULTIPLE_CHOICE",
        "OPEN_CLOZE",
        "GUIDED_CLOZE",
        "WORD_FORMATION",
        "SENTENCE_TRANSFORMATION",
        "ERROR_IDENTIFICATION",
        "TRIOS",
        "COLLOCATIONS",
        "PHRASAL_VERBS",
        "TRANSITIONS",
        "GRAMMAR_FOCUS",
      ],
    };
  }

  if (skill && skillOrder.includes(skill as SkillType)) {
    where.skillType = skill as SkillType;
  }

  if (difficulty && difficultyOrder.includes(difficulty as Difficulty)) {
    where.difficulty = difficulty as Difficulty;
  }

  if (topic) {
    where.problemTopics = { some: { topic: { slug: topic } } };
  }

  if (source) {
    where.sourceCollectionId = source;
  }

  let effectiveStatusFilter = statusFilter;
  if (user && personalized) {
    if (personalized === "level" || personalized === "challenge") {
      const latestDiagnostic = await prisma.diagnosticAttempt.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      const level = latestDiagnostic?.estimatedLevel ?? "B2";
      const levelIndex = difficultyOrder.indexOf(level);
      where.difficulty = personalized === "challenge" ? difficultyOrder[Math.min(difficultyOrder.length - 1, levelIndex + 1)] : level;
    }

    if (personalized === "weak-skill") {
      const weakSkills = await prisma.userSkillProfile.findMany({
        where: { userId: user.id, attempted: { gte: 3 }, accuracy: { lt: 0.7 } },
        select: { skillType: true },
      });
      where.skillType = { in: weakSkills.map((item) => item.skillType) };
    }

    if (personalized === "weak-topic") {
      const weakTopics = await prisma.userTopicProfile.findMany({
        where: { userId: user.id, attempted: { gte: 3 }, accuracy: { lt: 0.7 } },
        select: { topicId: true },
      });
      where.problemTopics = { some: { topicId: { in: weakTopics.map((item) => item.topicId) } } };
    }

    if (personalized === "not-attempted") {
      effectiveStatusFilter = "NOT_ATTEMPTED";
    }

    if (personalized === "wrong") {
      effectiveStatusFilter = "WRONG";
    }
  }

  if (q) {
    where.OR = [{ title: { contains: q } }, { statement: { contains: q } }];
  }

  const [problems, topics, sources, statuses] = await Promise.all([
    prisma.problem.findMany({
      where,
      include: {
        sourceCollection: { select: { name: true } },
        problemTopics: { include: { topic: { select: { name: true, slug: true } } } },
      },
      orderBy: [{ orderIndex: "asc" }],
    }),
    prisma.topic.findMany({
      where: canManageContent && includeDrafts ? undefined : { problemTopics: { some: { problem: { contentStatus: "PUBLISHED" } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.sourceCollection.findMany({
      where: canManageContent && includeDrafts ? undefined : { problems: { some: { contentStatus: "PUBLISHED" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    user
      ? prisma.userProblemStatus.findMany({
          where: { userId: user.id },
          select: { problemId: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const statusByProblem = new Map(statuses.map((item) => [item.problemId, item.status]));
  const items: ProblemListItem[] = problems
      .map((problem) => ({
        ...problem,
        contentStatus: problem.contentStatus,
        status: statusByProblem.get(problem.id) ?? "NOT_ATTEMPTED",
      }))
    .filter((problem) => !effectiveStatusFilter || problem.status === effectiveStatusFilter);

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <ProblemFilters
        topics={topics}
        sources={sources}
        values={{
          q,
          skill,
          difficulty,
          topic,
          status: effectiveStatusFilter,
          source,
          mode,
          personalized,
          includeDrafts: includeDrafts ? "1" : undefined,
        }}
        showContentToggle={Boolean(canManageContent)}
      />
      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">Kho luyện tập</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Duyệt bài theo kỹ năng</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Tìm Reading, Writing, Listening hoặc Use of English theo topic, độ khó, nguồn và trạng thái luyện tập cá nhân.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["/problems?personalized=level", "Phù hợp với trình độ"],
              ["/problems?personalized=weak-skill", "Dạng bài yếu"],
              ["/problems?personalized=weak-topic", "Topic yếu"],
              ["/problems?personalized=wrong", "Đã sai"],
              ["/problems?personalized=challenge", "Thử thách"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent-soft">
                {label}
              </a>
            ))}
          </div>
        </div>
        {items.length ? (
          <ProblemTable problems={items} />
        ) : (
          <EmptyState title="Không có bài phù hợp" description="Thử bỏ bớt bộ lọc hoặc chọn kỹ năng khác." />
        )}
      </section>
    </div>
  );
}
