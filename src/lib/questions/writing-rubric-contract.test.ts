import { describe, expect, it } from "vitest";
import {
  projectWritingRubric,
  WRITING_RUBRIC_LIMITS,
} from "@/lib/questions/writing-rubric-contract";

describe("Writing authored-rubric presentation contract", () => {
  it("projects the supported ordered string array and trims visible text", () => {
    expect(projectWritingRubric({
      manualReview: true,
      rubric: [" Task response ", "Coherence and cohesion"],
      modelAnswer: "LEARNER_MUST_NOT_SEE_THIS",
    })).toEqual({
      criteria: ["Task response", "Coherence and cohesion"],
    });
  });

  it("accepts exactly 12 criteria and exactly 240 UTF-16 code units", () => {
    const criteria = Array.from(
      { length: WRITING_RUBRIC_LIMITS.maxCriteria },
      (_, index) => `Criterion ${index + 1}`,
    );
    expect(projectWritingRubric({ rubric: criteria })).toEqual({ criteria });

    const maximumLengthCriterion = "x".repeat(
      WRITING_RUBRIC_LIMITS.maxCriterionLength,
    );
    expect(projectWritingRubric({
      rubric: [maximumLengthCriterion],
    })).toEqual({
      criteria: [maximumLengthCriterion],
    });
  });

  it("counts astral characters as two UTF-16 code units", () => {
    const acceptedCriterion = "😀".repeat(120);
    const rejectedCriterion = "😀".repeat(121);

    expect(acceptedCriterion.length).toBe(240);
    expect(rejectedCriterion.length).toBe(242);
    expect(projectWritingRubric({
      rubric: [acceptedCriterion],
    })).toEqual({
      criteria: [acceptedCriterion],
    });
    expect(projectWritingRubric({
      rubric: [rejectedCriterion],
    })).toBeNull();
  });

  it.each([
    ["missing rubric", {}],
    ["null answer", null],
    ["array answer", ["Task response"]],
    ["scalar answer", "Task response"],
    ["object rubric", { rubric: { criterion: "Task response" } }],
    ["scalar rubric", { rubric: "Task response" }],
    ["null rubric", { rubric: null }],
    ["nested array criterion", { rubric: [["Task response"]] }],
    ["object criterion", { rubric: [{ label: "Task response" }] }],
    ["null criterion", { rubric: [null] }],
  ])("returns null for %s", (_label, value) => {
    expect(projectWritingRubric(value)).toBeNull();
  });

  it("rejects blank, overlong, empty, and over-count rubrics without partial output", () => {
    expect(projectWritingRubric({ rubric: ["Task response", "   "] }))
      .toBeNull();
    expect(projectWritingRubric({
      rubric: ["x".repeat(WRITING_RUBRIC_LIMITS.maxCriterionLength + 1)],
    })).toBeNull();
    expect(projectWritingRubric({ rubric: [] })).toBeNull();
    expect(projectWritingRubric({
      rubric: Array.from(
        { length: WRITING_RUBRIC_LIMITS.maxCriteria + 1 },
        (_, index) => `Criterion ${index + 1}`,
      ),
    })).toBeNull();
  });

  it("is deterministic and does not mutate caller-owned values", () => {
    const rubric = Object.freeze([" Task response ", " Coherence "]);
    const answer = Object.freeze({
      manualReview: true,
      rubric,
      internalNote: "ADMIN_ONLY",
    });

    const first = projectWritingRubric(answer);
    const second = projectWritingRubric(answer);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first?.criteria).not.toBe(rubric);
    expect(answer.rubric).toEqual([" Task response ", " Coherence "]);
  });

  it("does not invoke accessor properties", () => {
    let accessed = false;
    const answer = Object.defineProperty({}, "rubric", {
      get() {
        accessed = true;
        return ["Task response"];
      },
    });

    expect(projectWritingRubric(answer)).toBeNull();
    expect(accessed).toBe(false);
  });
});
