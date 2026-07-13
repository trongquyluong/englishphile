import { NextRequest, NextResponse } from "next/server";
import { requireContentAdminApi } from "@/lib/auth/content-admin-api";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";
import { hasValidXlsxSignature, MAX_FILE_SIZE_BYTES } from "@/lib/import/resource-limits";

export async function POST(req: NextRequest) {
  const authorization = await requireContentAdminApi();
  if (!authorization.authorized) return authorization.response;

  // Validate request origin (CSRF protection)
  const originCheck = await validateRequestOrigin();
  if (!originCheck.valid) {
    return NextResponse.json({ error: getOriginErrorMessage() }, { status: 403 });
  }

  const user = authorization.user;

  // Rate limit Excel parse: 10 requests per admin per hour (database-backed)
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.EXCEL_PARSE(user.id));
  if (limit.status !== "allowed") {
    if (limit.status === "infrastructure-error") {
      return NextResponse.json(
        { error: "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Bạn đã parse quá nhiều file. Thử lại sau vài phút." },
      { status: 429 }
    );
  }

  let fileBuffer: ArrayBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Không có file." }, { status: 400 });
    }

    // Only accept .xlsx files
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Chỉ chấp nhận file .xlsx." }, { status: 400 });
    }

    // Reject macro-enabled files
    if (file.name.toLowerCase().endsWith(".xlsm")) {
      return NextResponse.json({ error: "Không chấp nhận file .xlsm (macro)." }, { status: 400 });
    }

    // Check file size against limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File vượt giới hạn ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB.` }, { status: 413 });
    }

    fileBuffer = await file.arrayBuffer();

    // Double-check byte length matches (prevents truncate/expand tricks)
    if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File vượt giới hạn kích thước." }, { status: 413 });
    }

    // Validate XLSX signature (PK zip header)
    if (!hasValidXlsxSignature(fileBuffer)) {
      return NextResponse.json({ error: "File không đúng định dạng XLSX." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Không đọc được file." }, { status: 400 });
  }

  try {
    const result = await parseExcelContest(fileBuffer);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[contest-import/parse]", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Lỗi khi đọc file Excel." }, { status: 500 });
  }
}
