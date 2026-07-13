export type ContentAdminIdentity = {
  email: string | null;
  role: "STUDENT" | "ADMIN";
};

export type ContentAdminApiDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; body: { error: string } };

export type ContentAdminDeploymentPreflight = {
  storedAdminCount: number;
  ownerEmailResolvesToCurrentUser: boolean;
  legacyTeacherCount: number;
};

const GENERIC_API_ERROR = "Không có quyền truy cập.";

export function normalizeAuthorizationEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function isConfiguredOwnerEmail(
  email: string | null | undefined,
  configuredOwnerEmail: string | null | undefined,
) {
  const ownerEmail = normalizeAuthorizationEmail(configuredOwnerEmail);
  return Boolean(ownerEmail && normalizeAuthorizationEmail(email) === ownerEmail);
}

export function isContentAdminIdentity(
  user: ContentAdminIdentity | null | undefined,
  configuredOwnerEmail: string | null | undefined,
) {
  return Boolean(
    user &&
      (user.role === "ADMIN" || isConfiguredOwnerEmail(user.email, configuredOwnerEmail)),
  );
}

export function decideContentAdminApiAccess(
  user: ContentAdminIdentity | null | undefined,
  configuredOwnerEmail: string | null | undefined,
): ContentAdminApiDecision {
  if (!user) {
    return { allowed: false, status: 401, body: { error: GENERIC_API_ERROR } };
  }

  if (!isContentAdminIdentity(user, configuredOwnerEmail)) {
    return { allowed: false, status: 403, body: { error: GENERIC_API_ERROR } };
  }

  return { allowed: true };
}

export function evaluateContentAdminDeploymentPreflight(
  input: ContentAdminDeploymentPreflight,
) {
  const countsAreValid =
    Number.isSafeInteger(input.storedAdminCount) &&
    input.storedAdminCount >= 0 &&
    Number.isSafeInteger(input.legacyTeacherCount) &&
    input.legacyTeacherCount >= 0;

  return {
    ready:
      countsAreValid &&
      (input.storedAdminCount > 0 || input.ownerEmailResolvesToCurrentUser),
    countsAreValid,
    legacyTeacherCount: input.legacyTeacherCount,
  };
}
