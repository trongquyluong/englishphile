export type PortableUserRole = "STUDENT" | "ADMIN";

export type PortableUserRoleResult = {
  role: PortableUserRole;
  legacyTeacherDowngraded: boolean;
};

export function parsePortableUserRole(value: unknown): PortableUserRoleResult {
  if (value === "STUDENT" || value === "ADMIN") {
    return { role: value, legacyTeacherDowngraded: false };
  }

  if (value === "TEACHER") {
    return { role: "STUDENT", legacyTeacherDowngraded: true };
  }

  throw new Error("Vai trò người dùng trong bản sao lưu không hợp lệ.");
}
