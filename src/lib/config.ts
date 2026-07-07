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

export function getAuthSecret() {
  return readEnv("SESSION_SECRET") ?? readEnv("AUTH_SECRET") ?? "local-development-secret-change-before-deploy";
}

export function getServerConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const authSecret = getAuthSecret();

  // Require a real secret in production.
  if (isProduction && authSecret === "local-development-secret-change-before-deploy") {
    throw new Error("SESSION_SECRET or AUTH_SECRET must be configured in production.");
  }

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
