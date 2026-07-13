export const RETIRED_CLASSROOM_MESSAGE = "Không tìm thấy tài nguyên.";

export type RetiredClassroomDecision = {
  allowed: false;
  status: 404;
  body: { error: string };
};

export function decideClassroomFeatureAccess(_principal?: unknown): RetiredClassroomDecision {
  void _principal;
  return {
    allowed: false,
    status: 404,
    body: { error: RETIRED_CLASSROOM_MESSAGE },
  };
}
