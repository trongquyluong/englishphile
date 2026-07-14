import { describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/assignments/[id]/submit/route";

describe("retired assignment submission route runtime", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ])("%s returns a generic 404 without reading the request body", async (_method, handler) => {
    const parseBody = vi.fn(() => {
      throw new Error("request body must not be parsed");
    });
    const invokeWithRequest = handler as unknown as (request: Request) => Response;
    const response = invokeWithRequest({ json: parseBody } as unknown as Request);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Không tìm thấy tài nguyên." });
    expect(parseBody).not.toHaveBeenCalled();
  });
});
