import { NextResponse } from "next/server";
import { importCsvRows } from "@/lib/import/csv-importer";
import { importJsonPayload } from "@/lib/import/json-importer";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return null;
  }
  return user;
}

export async function POST(request: Request) {
  const user = await requireAdminApi();
  if (!user) {
    return NextResponse.json({ error: "Bạn không có quyền import dữ liệu." }, { status: 403 });
  }
  const limit = checkRateLimit({ key: `admin-import-commit:${user.id}`, limit: 12, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: `Bạn import quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.` }, { status: 429 });
  }

  const body = (await request.json()) as {
    importType?: "JSON" | "CSV";
    content?: string;
    publishImmediately?: boolean;
  };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Nội dung import đang trống." }, { status: 400 });
  }

  const result =
    body.importType === "CSV"
      ? await importCsvRows(body.content, user.id, { publishImmediately: body.publishImmediately })
      : await importJsonPayload(body.content, user.id, { publishImmediately: body.publishImmediately });
  return NextResponse.json(result, { status: result.status === "FAILED" ? 422 : 200 });
}
