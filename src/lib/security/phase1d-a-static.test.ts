import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Phase 1D-A static wiring checks (not runtime/browser evidence)", () => {
  it.each([
    ["problem page", "src/app/problems/[slug]/page.tsx", "toLearnerProblemDTO", "problem={clientProblem}"],
    ["random-practice page", "src/app/practice/random/page.tsx", "toLearnerQuestionDTO", "<PracticeClient questions={randomQuestions}"],
    ["diagnostic selector", "src/lib/diagnostic.ts", "toLearnerQuestionDTO", "diagnosticPresentationQuestionSelect"],
  ])("maps the %s through learner-safe DTO wiring", (_label, file, mapper, boundary) => {
    const content = source(file);
    expect(content).toContain(mapper);
    expect(content).toContain(boundary);
  });

  it("uses an explicit question select before random-practice Client Component props", () => {
    const content = source("src/app/practice/random/page.tsx");
    expect(content).toContain("select: learnerQuestionPresentationSelect");
    expect(content).not.toContain("answer: question.answer");
    expect(content).not.toContain("explanation: question.explanation");
  });

  it.each([
    "src/app/api/submissions/route.ts",
    "src/app/api/practice/random/route.ts",
  ])("routes %s through centralized result allowlists, not checked feedback", (file) => {
    const content = source(file);
    expect(content).toMatch(/to(?:Submission|RandomPractice)ResultDTO/);
    const responseStart = content.indexOf("const response =");
    const responseBlock = content.slice(responseStart);
    expect(responseBlock).not.toContain("result.feedback");
    expect(responseBlock).not.toContain("result.correctAnswer");
  });

  it("diagnostic result page uses the ownership/finalization-scoped safe selector", () => {
    const content = source("src/app/diagnostic/result/page.tsx");
    expect(content).toContain("getLearnerDiagnosticResult(attemptId, user.id)");
    expect(content).not.toContain("prisma.diagnosticAttempt");
    expect(content).not.toContain("recommendationJson");
  });

  it("diagnostic finalization allowlists stored recommendationJson fields", () => {
    const content = source("src/lib/diagnostic.ts");
    const finalization = content.slice(content.indexOf("recommendationJson: {", content.indexOf("scoreDiagnosticAttempt")));
    expect(finalization).not.toContain("...existingMetadata");
    expect(finalization).not.toContain("correctAnswer:");
    expect(finalization).not.toContain("feedback:");
  });

  it("keeps admin answer mappings explicitly separate from learner mappings", () => {
    const adminPage = source("src/app/admin/problems/[id]/preview/page.tsx");
    const adminMapper = source("src/lib/dto/admin-problem-preview.ts");
    const learnerMapper = source("src/lib/dto/learner-question.ts");
    expect(adminPage).toContain("toAdminProblemPreviewDTO");
    expect(adminMapper).toContain('import "server-only"');
    expect(adminMapper).toContain("answer: question.answer");
    expect(learnerMapper).not.toContain("answer: question.answer");
    expect(learnerMapper).not.toContain("explanation: question.explanation");
  });

  it("learner review pages no longer render canonical-answer fields", () => {
    for (const file of [
      "src/app/analytics/page.tsx",
      "src/app/analytics/skills/[skillType]/page.tsx",
      "src/app/wrong-questions/page.tsx",
      "src/app/contests/[id]/result/page.tsx",
    ]) {
      const content = source(file);
      expect(content).not.toContain("summarizeCorrectAnswer");
      expect(content).not.toMatch(/item\.correctAnswer|question\.correctAnswer|answer\.correctAnswer/);
      if (file === "src/app/contests/[id]/result/page.tsx") expect(content).toContain("toLearnerContestResult(attempt.answersJson)");
    }
  });
});
