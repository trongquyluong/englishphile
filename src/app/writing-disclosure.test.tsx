import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("Writing data-processing disclosure", () => {
  it("keeps provider disclosure on the Privacy page", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));

    expect(html).toContain("Xử lý bài Writing");
    expect(html).toContain("Cloudflare Workers AI");
    expect(html).toContain("không đưa dữ liệu cá nhân không cần thiết vào bài viết");
  });

  it("records automated Writing processing in Terms and links to Privacy", () => {
    const html = renderToStaticMarkup(createElement(TermsPage));

    expect(html).toContain("nhận xét Writing tự động");
    expect(html).toContain("dịch vụ bên thứ ba");
    expect(html).toContain('href="/privacy"');
  });
});
