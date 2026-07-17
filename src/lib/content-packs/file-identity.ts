import { createHash } from "node:crypto";
import type { ImportType } from "@prisma/client";

export type ContentPackFileIdentity = {
  entryId: string;
  position: number;
  fileName: string;
  normalizedFileName: string;
  importType: ImportType;
  contentDigest: string;
};

export function normalizeContentPackFileName(fileName: string) {
  return fileName.trim().normalize("NFC").toLowerCase();
}

export function digestContentPackFile(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function deriveContentPackFileEntryId(
  position: number,
  normalizedFileName: string,
  importType: ImportType,
  contentDigest: string,
) {
  return createHash("sha256")
    .update(`${position}\0${normalizedFileName}\0${importType}\0${contentDigest}`, "utf8")
    .digest("hex");
}

export function createContentPackFileIdentity(
  fileName: string,
  importType: ImportType,
  content: string,
  position: number,
): ContentPackFileIdentity {
  const normalizedFileName = normalizeContentPackFileName(fileName);
  const contentDigest = digestContentPackFile(content);
  const entryId = deriveContentPackFileEntryId(position, normalizedFileName, importType, contentDigest);
  return { entryId, position, fileName, normalizedFileName, importType, contentDigest };
}

export function contentPackFileIdentityKey(
  identity: Pick<ContentPackFileIdentity, "entryId" | "position" | "normalizedFileName" | "importType" | "contentDigest">,
) {
  return [
    identity.entryId,
    String(identity.position),
    identity.normalizedFileName,
    identity.importType,
    identity.contentDigest,
  ].join("\0");
}

export function contentPackFileIdentityMatches(
  left: Pick<ContentPackFileIdentity, "entryId" | "position" | "normalizedFileName" | "importType" | "contentDigest">,
  right: Pick<ContentPackFileIdentity, "entryId" | "position" | "normalizedFileName" | "importType" | "contentDigest">,
) {
  return contentPackFileIdentityKey(left) === contentPackFileIdentityKey(right);
}
