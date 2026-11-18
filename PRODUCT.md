# Calendar Board — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `calendar-app`, evidence Prototype) on
> 2026-10-23.

## What it is

A client-side single-month grid with add/remove events per day, stored in the browser.

## Who it is for

A portfolio visitor who wants to see a small calendar UI, or anyone who needs a private scratch calendar on one
device.

## What works today

1. A Sunday-first 6x7 month grid with Prev / Today / Next; today and the selected day are marked; days with events
   show a count.
2. The side panel shows the selected day and its events, or an empty state; add an event (labelled title, required;
   labelled notes, optional) or remove one (Undo for six seconds). On narrow screens picking a day scrolls to the
   panel and focuses its heading.
3. Events persist in this browser's localStorage. Corrupt, wrongly shaped or impossibly dated stored data is dropped
   instead of crashing the page. A first visit shows one demo event on today's date.
4. The board renders in the browser on the visitor's local date, with en-US labels, so it no longer fails hydration
   on a later day or in a non-English browser.
5. `/api/mcp` answers JSON-RPC with `month_grid` (the same grid logic). It does not list events.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No month/week/day views, drag-to-schedule, colour categories, recurrence or cross-project schedule (claims removed
  from the portfolio card in the 2026-10 review).
- No times, reminders, editing an existing event, sharing or sync. No analytics of any kind (Vercel Analytics and Speed Insights removed 2026-11-18, owner decision 2026-11-17).

## Known limits

Open review findings (Codex, 2026-11-19), accepted for now and not yet fixed:

- After the Undo toast times out or is closed with Escape, the polite status region still holds the
  "Undo is available" / "Undo restores …" message until the next announcement.
- Day buttons are about 36px wide at a 320px viewport and 43.9px at 375px, under the 44px target in
  APP-SHELL.md; the grid's padding and gaps would need to shrink on narrow screens.
- On a stacked layout, jumping to a day applies the top-bar offset twice (`scroll-margin-top: 68px` on the
  heading plus `scroll-padding-top: 64px` on `html`, 132px). On very short viewports (for example 400% zoom)
  the heading can be partly cut off.
- Each keystroke in the composer re-renders the board and re-formats the date labels of all 42 day cells
  (about 1.3 to 2.6 ms per render in a Node measurement); the formatter or labels are not cached per month.
- Undo cannot be set to a longer time or switched off ahead of a removal. The six-second countdown pauses
  on hover, on focus the person moves into the toast, or on any key pressed there (a keyboard removal
  announces "Press an arrow key to keep Undo open"); a screen-reader user who only listens still has six
  seconds.
- The Event title field is not marked `required`, and the disabled Save event button is skipped by Tab,
  so a screen-reader user is not told directly that a title is needed to save.
- The held-Enter guard on Remove, Undo, Back to … and the day buttons relies on `KeyboardEvent.repeat`; a browser that repeats clicks
  without flagging the keydown as a repeat is not covered.
- The Undo focus, countdown and toast-spacing behaviour is covered by happy-dom tests only; it has not been
  checked by hand in a real browser or with a screen reader.

## Live URL and deploy state

- Live: https://calendar-app.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-calendar-app-frontend` is Git-linked as of 2026-11: a push to `main` deploys
  (the earlier CLI-only state and owner action D9 are closed). `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project
  (Sentry project `productivity-calendar-app-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
