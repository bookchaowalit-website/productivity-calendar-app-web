import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("prerenders the shell without baking in a date, plus the local-only notice", () => {
    // Regression: the build-time date and server locale were rendered into the static HTML, so a visitor on another
    // day or in another locale got a hydration mismatch. The board now renders only in the browser.
    const html = renderToString(<Home />);
    expect(html).toContain("Make room for the days that matter.");
    expect(html).toContain("LOCAL / BROWSER ONLY");
    expect(html).toContain("The calendar opens in your browser, on your local date.");
    expect(html).not.toMatch(/20\d\d-\d\d-\d\d|Portfolio demo event/);
    expect(html).toContain("This portfolio boundary is not a shared calendar or a multi-user service.");
  });
});

describe("calendar board", () => {
  it("renders the month, today's demo event and the selected-day panel for a given date", async () => {
    const { Board } = await import("@/app/calendar-board");
    const html = renderToString(<Board today="2026-10-23" />);
    expect(html).toContain("October 2026");
    expect(html).toContain("Friday");
    expect(html).toContain("October 23, 2026");
    expect(html).toContain("Portfolio demo event");
    expect(html).toContain('aria-pressed="true"><span class="day-number">23</span><span class="sr-only"> October 23, 2026</span>');
    expect(html).toContain('<span class="cell-note"><span class="sr-only">, </span>1 event</span>');
    expect(html).toContain("is-today");
  });
});
