import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { parseExcelContest } from "@/lib/import/excel-contest-parser";

export async function POST(req: NextRequest) {
  await requireAdmin();

  let fileBuffer: ArrayBuffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Không có file." }, { status: 400 });
    }
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json({ error: "Chỉ chấp nhận file .xlsx." }, { status: 400 });
    }
    fileBuffer = await file.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "Không đọc được file." }, { status: 400 });
  }

  try {
    const result = await parseExcelContest(fileBuffer);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[contest-import/parse]", err);
    return NextResponse.json({ error: "Lỗi khi đọc file Excel." }, { status: 500 });
  }
}
