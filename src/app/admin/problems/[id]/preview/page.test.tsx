import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProblem: vi.fn(),
  toPreview: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { problem: { findUnique: mocks.findProblem } } }));
vi.mock("@/lib/dto/admin-problem-preview", () => ({ toAdminProblemPreviewDTO: mocks.toPreview }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import AdminProblemPreviewPage from "@/app/admin/problems/[id]/preview/page";
import { ProblemClient } from "@/components/problems/ProblemClient";

function findElement(node: ReactNode, type: unknown): ReactElement | null {
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) return null;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element;
  const children = element.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, type);
}

describe("admin draft problem production-page preview boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.findProblem.mockResolvedValue({ id: "draft-problem", contentStatus: "DRAFT", questions: [{ id: "draft-question" }] });
    mocks.toPreview.mockReturnValue({ id: "draft-problem", contentStatus: "DRAFT", questions: [{ id: "draft-question" }] });
  });

  it("authorizes explicitly and renders the draft through non-persisting previewMode", async () => {
    const page = await AdminProblemPreviewPage({ params: Promise.resolve({ id: "draft-problem" }) });
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.findProblem).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "draft-problem" } }));
    expect(mocks.toPreview).toHaveBeenCalledWith(expect.objectContaining({ contentStatus: "DRAFT" }));
    const client = findElement(page, ProblemClient);
    expect(client).not.toBeNull();
    expect(client?.props).toEqual(expect.objectContaining({ previewMode: true, isAuthenticated: true, history: [] }));
  });
});
