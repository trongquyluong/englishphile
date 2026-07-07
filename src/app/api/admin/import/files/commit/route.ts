import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { importContentPackFiles, type ContentPackInputFile } from "@/lib/content-packs/importer";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const user = await requireAdminApi();
  if (!user) {
    return NextResponse.json({ error: "Bạn không có quyền import dữ liệu." }, { status: 403 });
  }
  const limit = checkRateLimit({ key: `admin-files-commit:${user.id}`, limit: 12, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: `Bạn import file quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.` }, { status: 429 });
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
