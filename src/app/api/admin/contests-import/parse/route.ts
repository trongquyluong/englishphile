import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";
import { hasValidXlsxSignature, MAX_FILE_SIZE_BYTES } from "@/lib/import/resource-limits";

export async function POST(req: NextRequest) {
  await requireAdmin();

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
