import { describe, expect, it, vi } from "vitest";
import { preventsProblemSubmission, requestProblemSubmission } from "@/components/problems/ProblemClient";

describe("problem client production preview guard", () => {
  it("prevents persistence only for explicit preview mode", () => {
    expect(preventsProblemSubmission(true)).toBe(true);
    expect(preventsProblemSubmission(false)).toBe(false);
  });

  it("never invokes the learner API callback in preview mode", async () => {
    const persist = vi.fn<() => Promise<Response>>();
    await expect(requestProblemSubmission(true, persist)).resolves.toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });
});
