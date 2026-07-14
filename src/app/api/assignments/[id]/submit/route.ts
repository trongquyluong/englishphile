import { NextResponse } from "next/server";
import { decideClassroomFeatureAccess } from "@/lib/features/retired-classroom-policy";

function retiredResponse() {
  const decision = decideClassroomFeatureAccess();
  return NextResponse.json(decision.body, { status: decision.status });
}

export const GET = retiredResponse;
export const POST = retiredResponse;
export const PUT = retiredResponse;
export const PATCH = retiredResponse;
export const DELETE = retiredResponse;
