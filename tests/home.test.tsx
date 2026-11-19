import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("prerenders the shell without baking in a date, plus the local-only notice and hub links", () => {
    // Regression: the build-time date and server locale were rendered into the static HTML, so a visitor on another
    // day or in another locale got a hydration mismatch. The board now renders only in the browser.
    const html = renderToString(<Home />);
    expect(html).toContain("The calendar opens in your browser, on your local date.");
    // A 6 x 7 skeleton month and a panel placeholder keep the footprint of the board (no layout shift).
    expect(html.match(/<span class="as-day"><\/span>/g)).toHaveLength(42);
    expect(html).toContain('class="as-panel as-panel-skeleton"');
    // The month nav row is reserved too (it wraps to its own full-width row at 760px and below).
    expect(html).toMatch(/<div class="as-tools as-cal-nav" aria-hidden="true">(<button[^>]*disabled[^>]*tabindex="-1"[^>]*>(Prev|Today|Next)<\/button>){3}<\/div>/);
    expect(html).toContain("<noscript>");
    expect(html).not.toMatch(/20\d\d-\d\d-\d\d|Portfolio demo event/);
    expect(html).toContain("This is not a shared calendar");
    expect(html).toContain('href="https://bookchaowalit.com/"');
    expect(html).not.toContain("more-projects");
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
    expect(html).toContain('aria-pressed="true" aria-label="Friday, October 23, 2026, 1 event: Portfolio demo event, today"');
    expect(html).toContain('<span class="as-day-count" aria-hidden="true">1</span>');
    expect(html).toContain('aria-label="Remove Portfolio demo event"');
  });
});
