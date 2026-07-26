import { NextResponse } from "next/server";
import { requireContentAdminApi } from "@/lib/auth/content-admin-api";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { importContentPackFiles, type ContentPackInputFile } from "@/lib/content-packs/importer";
import { isContentAdminTransactionAuthorizationError } from "@/lib/auth/content-admin-transaction";

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
  const authorization = await requireContentAdminApi();
  if (!authorization.authorized) return authorization.response;

  // Validate request origin (CSRF protection)
  const originCheck = await validateRequestOrigin();
  if (!originCheck.valid) {
    return NextResponse.json({ error: getOriginErrorMessage() }, { status: 403 });
  }

  const user = authorization.user;

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

  try {
    const result = await importContentPackFiles(files, user.id, {
      publishImmediately: body.publishImmediately === true,
      fileName: files.length === 1 ? files[0].fileName : undefined,
    });
    const importedAnyFile = result.results.some((file) => file.status === "IMPORTED");
    return NextResponse.json(result, { status: importedAnyFile ? 200 : 422 });
  } catch (error) {
    if (isContentAdminTransactionAuthorizationError(error)) {
      return NextResponse.json({ error: "Không có quyền truy cập." }, { status: 403 });
    }
    return NextResponse.json({ error: "Không thể hoàn tất gói dữ liệu." }, { status: 500 });
  }
}
