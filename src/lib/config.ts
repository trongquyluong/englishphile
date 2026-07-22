import "server-only";

type ServerConfig = {
  databaseUrl: string;
  directUrl: string | null;
  authSecret: string;
  ownerEmail: string | null;
  appUrl: string | null;
  nodeEnv: string;
  isProduction: boolean;
};

function readEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function required(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const LOCAL_AUTH_SECRET_FALLBACK = "local-development-secret-change-before-deploy";

type AuthSecretEnvironment = {
  NODE_ENV?: string;
  SESSION_SECRET?: string;
  AUTH_SECRET?: string;
};

export function resolveAuthSecret(environment: AuthSecretEnvironment) {
  const configured = environment.SESSION_SECRET?.trim() || environment.AUTH_SECRET?.trim() || null;
  if (environment.NODE_ENV === "production" && (!configured || configured === LOCAL_AUTH_SECRET_FALLBACK)) {
    throw new Error("Authentication signing configuration is unavailable.");
  }
  return configured ?? LOCAL_AUTH_SECRET_FALLBACK;
}

export function getAuthSecret(environment: AuthSecretEnvironment = process.env) {
  return resolveAuthSecret(environment);
}

export function getServerConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const authSecret = getAuthSecret();

  // Require DATABASE_URL everywhere.
  const databaseUrl = required("DATABASE_URL");

  // DIRECT_URL is optional at runtime (only needed for migrations / db push).
  // It is validated later when actually used by migration scripts.
  const directUrl = readEnv("DIRECT_URL") ?? null;

  return {
    databaseUrl,
    directUrl,
    authSecret,
    ownerEmail: readEnv("OWNER_EMAIL")?.toLowerCase() ?? null,
    appUrl: readEnv("NEXT_PUBLIC_APP_URL"),
    nodeEnv,
    isProduction,
  };
}
