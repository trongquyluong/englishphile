import { NextResponse } from "next/server";
import { importCsvRows } from "@/lib/import/csv-importer";
import { importJsonPayload } from "@/lib/import/json-importer";
import { getCurrentUser, isAdminUser } from "@/lib/auth/session";
import { validateRequestOrigin, getOriginErrorMessage } from "@/lib/security/request-origin";
import { checkConfiguredRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return null;
  }
  return user;
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
  const limit = await checkConfiguredRateLimit(RATE_LIMITS.IMPORT_COMMIT(user.id));
  if (limit.status !== "allowed") {
    if (limit.status === "infrastructure-error") {
      return NextResponse.json({ error: "Dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau." }, { status: 503 });
    }
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
