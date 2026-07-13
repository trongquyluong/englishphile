import "server-only";

import { NextResponse } from "next/server";
import { runSecurityCleanup } from "@/lib/security/cleanup";
import { isCronRequestAuthorized } from "@/lib/security/cleanup-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const METHOD_NOT_ALLOWED_HEADERS = { ...NO_STORE_HEADERS, Allow: "GET" } as const;

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: METHOD_NOT_ALLOWED_HEADERS });
}

export const HEAD = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

export async function GET(request: Request) {
  const startedAt = Date.now();
  if (!isCronRequestAuthorized(process.env.CRON_SECRET, request.headers.get("authorization"))) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await runSecurityCleanup();
    const logEntry = {
      event: "security_cleanup",
      success: result.status === "success",
      counts: result.counts,
      totalAffected: result.totalAffected,
      failedComponents: result.failedComponents,
      durationMs: result.durationMs,
    };

    if (result.status === "failure") {
      console.error("[security-cleanup]", logEntry);
      return json({ ok: false, error: "Cleanup failed", durationMs: result.durationMs }, 500);
    }

    console.info("[security-cleanup]", logEntry);
    return json(
      {
        ok: true,
        counts: result.counts,
        totalAffected: result.totalAffected,
        durationMs: result.durationMs,
      },
      200,
    );
  } catch {
    const durationMs = Math.max(0, Date.now() - startedAt);
    console.error("[security-cleanup]", {
      event: "security_cleanup",
      success: false,
      durationMs,
    });
    return json({ ok: false, error: "Cleanup failed", durationMs }, 500);
  }
}
