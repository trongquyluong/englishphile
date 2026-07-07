import { NextResponse } from "next/server";
import { validateCsvRows } from "@/lib/import/csv-importer";
import { validateJsonImport } from "@/lib/import/json-importer";
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
  const limit = checkRateLimit({ key: `admin-import-validate:${user.id}`, limit: 30, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: `Bạn kiểm tra dữ liệu quá nhanh. Hãy đợi ${limit.retryAfterSeconds} giây rồi thử lại.` }, { status: 429 });
  }

  const body = (await request.json()) as {
    importType?: "JSON" | "CSV";
    content?: string;
  };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Nội dung import đang trống." }, { status: 400 });
  }

  const plan = body.importType === "CSV" ? await validateCsvRows(body.content) : await validateJsonImport(body.content);
  return NextResponse.json(plan);
}
