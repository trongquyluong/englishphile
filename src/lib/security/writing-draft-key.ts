import "server-only";

import { createHmac } from "node:crypto";
import { getAuthSecret } from "@/lib/config";

const WRITING_DRAFT_KEY_CONTEXT = "englishphile-writing-draft-v1";

/**
 * Produce a stable opaque browser-draft key without exposing either the
 * authenticated user ID or static prompt slug to the Client Component.
 */
export function deriveWritingDraftKey(userId: string, promptSlug: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(WRITING_DRAFT_KEY_CONTEXT)
    .update("\0")
    .update(userId)
    .update("\0")
    .update(promptSlug)
    .digest("base64url");
}
