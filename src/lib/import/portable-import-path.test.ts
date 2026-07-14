import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePortableImportFile } from "@/lib/import/portable-import-path";

describe("portable import path resolution runtime", () => {
  it("resolves a fixed import-step file inside the selected input directory", () => {
    const inputDirectory = path.resolve("portable-review-input");

    expect(resolvePortableImportFile(inputDirectory, "users.safe.json")).toBe(
      path.join(inputDirectory, "users.safe.json"),
    );
  });

  it("rejects traversal and absolute file names", () => {
    const inputDirectory = path.resolve("portable-review-input");

    expect(() => resolvePortableImportFile(inputDirectory, "../users.safe.json")).toThrow(
      "Tên file import portable không hợp lệ.",
    );
    expect(() => resolvePortableImportFile(inputDirectory, "nested\\users.safe.json")).toThrow(
      "Tên file import portable không hợp lệ.",
    );
    expect(() => resolvePortableImportFile(inputDirectory, path.resolve("users.safe.json"))).toThrow(
      "Tên file import portable không hợp lệ.",
    );
  });

  it("rejects a missing selected input directory", () => {
    expect(() => resolvePortableImportFile("  ", "users.safe.json")).toThrow(
      "Thiếu thư mục import portable.",
    );
  });
});
