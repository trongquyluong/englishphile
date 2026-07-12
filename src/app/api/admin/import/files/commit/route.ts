import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { importContentPackFiles, type ContentPackInputFile } from "@/lib/content-packs/importer";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return null;
  }
  return user;
}

function normalizeFiles(value: unknown): ContentPackInputFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const file = item as Record<string, unknown>;
      const fileName = typeof file.fileName === "string" ? file.fileName.trim() : "";
      const content = typeof file.content === "string" ? file.content : "";
      return fileName && content.trim() ? { fileName, content } : null;
    })
    .filter((item): item is ContentPackInputFile => Boolean(item));
}

export async function POST(request: Request) {
  // Validate request origin (CSRF protection)
  const originCheck = await validateRequestOrigin();
  if (!originCheck.valid) {
    return NextResponse.json({ error: getOriginErrorMessage() }, { status: 403 });
  }

  const user = await requireAdminApi();
  if (!user) {
    return NextResponse.json({ error: "Bạn không có quyền import dữ liệu." }, { status: 403 });
  }

  // Rate limit Excel import commit: 5 imports per admin per hour (database-backed)
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.CONTENT_PACK_COMMIT(user.id));
  if (limit.status !== "allowed") {
    if (limit.status === "infrastructure-error") {
      return NextResponse.json(
        { error: "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `Bạn đã import quá nhiều lần. Thử lại sau khoảng ${limit.retryAfterSeconds} giây.` },
      { status: 429 }
    );
  }

  const body = (await request.json()) as {
    files?: unknown;
    publishImmediately?: boolean;
  };
  const files = normalizeFiles(body.files);
  if (!files.length) {
    return NextResponse.json({ error: "Chưa có file JSON/CSV hợp lệ." }, { status: 400 });
  }

  const result = await importContentPackFiles(files, user.id, {
    publishImmediately: body.publishImmediately === true,
    fileName: files.length === 1 ? files[0].fileName : undefined,
  });
  return NextResponse.json(result, { status: result.summary.validFiles > 0 ? 200 : 422 });
}
