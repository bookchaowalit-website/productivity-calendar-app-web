import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/layout";

vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "font-inter" }) }));

describe("site metadata", () => {
  it("robots, sitemap and canonical use the app's own subdomain", () => {
    expect(robots().sitemap).toBe("https://calendar-app.bookchaowalit.com/sitemap.xml");
    expect(sitemap()[0].url).toBe("https://calendar-app.bookchaowalit.com/");
    expect(String(metadata.metadataBase)).toBe("https://calendar-app.bookchaowalit.com/");
    expect(metadata.alternates?.canonical).toBe("/");
  });
});

describe("root layout", () => {
  it("puts the font variable on <html>", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const html = RootLayout({ children: null });
    expect(html.props.className).toBe("font-inter");
    expect(html.props.lang).toBe("en");
  });
});
