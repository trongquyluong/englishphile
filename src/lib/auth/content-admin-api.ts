import "server-only";

import { NextResponse } from "next/server";
import { decideContentAdminApiAccess } from "@/lib/auth/content-admin-policy";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireContentAdminApi() {
  const user = await getCurrentUser();
  const decision = decideContentAdminApiAccess(user, process.env.OWNER_EMAIL);

  if (!decision.allowed) {
    return {
      authorized: false as const,
      response: NextResponse.json(decision.body, { status: decision.status }),
    };
  }

  return { authorized: true as const, user: user! };
}
