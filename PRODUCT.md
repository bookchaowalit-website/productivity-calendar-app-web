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
2. The side panel shows the selected day and its events; add an event (title required, notes optional) or remove one.
3. Events persist in this browser's localStorage. Corrupt, wrongly shaped or impossibly dated stored data is dropped
   instead of crashing the page. A first visit shows one demo event on today's date.
4. The board renders in the browser on the visitor's local date, with en-US labels, so it no longer fails hydration
   on a later day or in a non-English browser.
5. `/api/mcp` answers JSON-RPC with `month_grid` (the same grid logic). It does not list events.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No month/week/day views, drag-to-schedule, colour categories, recurrence or cross-project schedule (claims removed
  from the portfolio card in the 2026-10 review).
- No times, reminders, editing an existing event, sharing or sync. No product analytics beyond Vercel Analytics.

## Live URL and deploy state

- Live: https://calendar-app.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-calendar-app-frontend` is deployed only by CLI. Its last production deploy is
  2026-10-08 01:38 UTC (CLI): the Next 16.4.2 security patch on `main` was not deployed yet because Vercel's daily
  deployment quota ran out on 2026-10-23; the batch coordinator deploys the latest green `main` later. The Git link
  names the old repository `bookchaowalit/bookchaowalit-calendar-app-frontend`, so a push to `main` does not deploy
  (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project
  `productivity-calendar-app-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
