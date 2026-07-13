import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retiredClassroomNotFound: vi.fn(),
}));

vi.mock("@/lib/features/retired-classroom", () => ({
  retiredClassroomNotFound: mocks.retiredClassroomNotFound,
}));

import {
  assignmentStatusAction,
  createAssignmentAction,
  createClassroomAction,
  joinClassroomAction,
  regenerateJoinCodeAction,
  updateClassroomAction,
} from "@/app/teacher/actions";
import { saveManualGradeAction } from "@/app/teacher/grading/actions";

describe("retired classroom Server Action tombstones runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retiredClassroomNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it.each([
    ["create classroom", createClassroomAction],
    ["update classroom", updateClassroomAction],
    ["regenerate join code", regenerateJoinCodeAction],
    ["join classroom", joinClassroomAction],
    ["create assignment", createAssignmentAction],
    ["change assignment status", assignmentStatusAction],
    ["save manual grade", saveManualGradeAction],
  ])("%s terminates at the retired-feature guard", async (_name, action) => {
    await expect(action(new FormData())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.retiredClassroomNotFound).toHaveBeenCalledTimes(1);
  });
});
