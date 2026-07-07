import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

export async function GET() {
  const health = await checkHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
