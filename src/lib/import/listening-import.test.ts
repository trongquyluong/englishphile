import { describe, expect, it } from "vitest";
import { normalizeJsonPayload } from "./validation";

describe("Listening normalizer loops", () => {
  const validMetadata = {
    listening: {
      version: 1,
      audio: {
        assetRef: "/media/listening/pilot-001/dialogue-01-v1.mp3",
        mimeType: "audio/mpeg",
        byteLength: 2457600,
        durationMs: 92000,
      },
      transcript: {
        text: "Transcript",
        languageTag: "en",
        availabilityPolicy: "AFTER_SUBMISSION",
      },
      attribution: {
        displayText: "Attribution",
      },
      rights: {
        classification: "OWNED",
        evidenceRef: "rights:1",
      },
      unavailableBehavior: "BLOCK_PROBLEM",
    },
  };

  const validSourceCollection = {
    name: "Source",
  };

  describe("JSON Normalization (LISTENING_MCQ)", () => {
    it("preserves canonical LISTENING_MCQ and returns no errors", () => {
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_MCQ",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_MCQ",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                options: [
                  { id: "A", text: "Option A" },
                  { id: "B", text: "Option B" },
                  { id: "C", text: "Option C" },
                ],
                answer: { correctOptionId: "B" },
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      const issues = result.issues.filter((i) => i.level === "error");
      expect(issues).toHaveLength(0);
    });

    it("normalizes deprecated correctOption alias", () => {
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_MCQ",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_MCQ",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                options: [
                  { id: "A", text: "Option A" },
                  { id: "B", text: "Option B" },
                  { id: "C", text: "Option C" },
                ],
                answer: { correctOption: "B" }, // deprecated alias
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      expect(result.payload!.problems[0].questions[0].answer).toEqual({
        correctOption: "B",
        correctOptionId: "B",
      });
      const issues = result.issues.filter((i) => i.level === "error");
      expect(issues).toHaveLength(0);
    });

    it("flags defects as fatal validation errors", () => {
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_MCQ",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_MCQ",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                options: [], // invalid
                answer: { correctOptionId: "Z" }, // invalid
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      expect(result.payload?.problems).toHaveLength(0);
      const issues = result.issues.filter((i) => i.level === "error");
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.code === "LISTENING_MCQ_OPTIONS_REQUIRED")).toBe(true);
      expect(issues.some(i => i.code === "LISTENING_MCQ_CORRECT_OPTION_NOT_IN_OPTIONS")).toBe(true);
    });

    it("normalizes transcript CRLF to LF without mutating caller input", () => {
      const crlfMetadata = JSON.parse(JSON.stringify(validMetadata));
      crlfMetadata.listening.transcript.text = "Line 1\r\nLine 2\r\nLine 3";
      
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_MCQ",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_MCQ",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                options: [
                  { id: "A", text: "Option A" },
                  { id: "B", text: "Option B" },
                  { id: "C", text: "Option C" },
                ],
                answer: { correctOptionId: "B" },
                metadata: crlfMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      const normalizedMetadata = result.payload!.problems[0].questions[0].metadata as { listening: { transcript: { text: string } } };
      expect(normalizedMetadata.listening.transcript.text).toBe("Line 1\nLine 2\nLine 3");
      expect(crlfMetadata.listening.transcript.text).toBe("Line 1\r\nLine 2\r\nLine 3"); // caller unmodified
    });

    it("emits NEEDS_REVIEW warnings for legacy aliases and preserves them", () => {
      const legacyMetadata = JSON.parse(JSON.stringify(validMetadata));
      legacyMetadata.audioUrl = "/legacy.mp3";
      legacyMetadata.sectionType = "dialogue";
      
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_MCQ",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_MCQ",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                options: [
                  { id: "A", text: "Option A" },
                  { id: "B", text: "Option B" },
                  { id: "C", text: "Option C" },
                ],
                answer: { correctOptionId: "B" },
                metadata: legacyMetadata,
              },
            ],
          },
        ],
      });
      
      const warnings = result.issues.filter(i => i.level === "warning");
      expect(warnings.some(i => i.code === "LISTENING_LEGACY_AUDIO_URL")).toBe(true);
      expect(warnings.some(i => i.code === "LISTENING_LEGACY_SECTION_TYPE")).toBe(true);
    });
  });

  describe("JSON Normalization (LISTENING_SHORT_ANSWER)", () => {
    it("preserves canonical LISTENING_SHORT_ANSWER and returns no errors", () => {
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_SHORT_ANSWER",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_SHORT_ANSWER",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                answer: { acceptedAnswers: ["canonical answer"] },
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      const issues = result.issues.filter((i) => i.level === "error");
      expect(issues).toHaveLength(0);
    });

    it("normalizes supported accepted alias into canonical acceptedAnswers and resolves conflicts", () => {
      // both aliases equal
      const equalResult = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_SHORT_ANSWER",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_SHORT_ANSWER",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                answer: { accepted: ["ans1"], acceptedAnswers: ["ans1"] }, // both
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(equalResult.payload).not.toBeNull();
      expect((equalResult.payload!.problems[0].questions[0].answer as Record<string, unknown>).acceptedAnswers).toEqual(["ans1"]);
      
      // aliases conflicting (accepted takes precedence via ?? operator in normalizeAnswer)
      const conflictResult = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_SHORT_ANSWER",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_SHORT_ANSWER",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                answer: { accepted: ["ans2"], acceptedAnswers: ["ignored"] }, // conflicting
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(conflictResult.payload).not.toBeNull();
      expect((conflictResult.payload!.problems[0].questions[0].answer as Record<string, unknown>).acceptedAnswers).toEqual(["ans2"]);
    });

    it("flags defects as fatal validation errors", () => {
      const result = normalizeJsonPayload({
        sourceCollection: validSourceCollection,
        problems: [
          {
            title: "Problem",
            skillType: "LISTENING",
            questionType: "LISTENING_SHORT_ANSWER",
            difficulty: "C1",
            statement: "Statement",
            questions: [
              {
                type: "LISTENING_SHORT_ANSWER",
                skillType: "LISTENING",
                difficulty: "C1",
                prompt: "Prompt",
                answer: { acceptedAnswers: [] }, // invalid
                metadata: validMetadata,
              },
            ],
          },
        ],
      });
      expect(result.payload).not.toBeNull();
      expect(result.payload?.problems).toHaveLength(0);
      const issues = result.issues.filter((i) => i.level === "error");
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.code === "LISTENING_SHORT_ACCEPTED_REQUIRED")).toBe(true);
    });
  });
});
