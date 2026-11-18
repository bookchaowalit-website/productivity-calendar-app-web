# Calendar Board

A single-month calendar kept in your browser: move between months, pick a day, and add or remove events (title and
optional notes) on it. Days show how many events they hold. Events are saved in this browser's localStorage only; a
first visit shows one demo event on today's date.

Live: https://calendar-app.bookchaowalit.com (Vercel Git deploy: a push to `main` deploys).

The page uses the shared App shell (`APP-SHELL.md`): Inter, light and dark from the system setting, a month of
day buttons beside the selected-day panel (stacked under it below 960px, where picking a day scrolls to the panel and
focuses its heading). Removing an event shows an Undo toast for six seconds. No analytics.

## What it does not do

- No week or day view, drag-to-schedule, colour categories, recurrence, reminders or time of day.
- No sharing, sync, import/export or account. Clearing site data removes your events.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: date and event logic, stored-state hook, MCP route, render + mounted happy-dom interaction tests, Sentry
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/calendar.ts`: date keys (`ymd`, `parseYmd`), `monthMatrix`, `shiftMonth`, en-US labels, `parseEvents`
  (rejects corrupt or badly dated storage), `addEvent`, `removeEvent`, `countByDate`.
- `lib/use-today.ts`: today's date in the browser only, so the build-time prerender never bakes in a day.
- `lib/use-stored-state.ts`: localStorage-backed state via `useSyncExternalStore`.
- `app/calendar-board.tsx`: the month and selected-day panel (add, remove + Undo); `app/page.tsx` mounts it once the
  date is known, inside the App shell top bar and footer.
- `app/app-shell.css`, `components/app-shell.tsx`: the shared App shell (copied per repository, see `APP-SHELL.md`).
- `lib/site.ts`: the app's own URL, used by metadata, `app/robots.ts` and `app/sitemap.ts`.
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `month_grid` (the board's 6x7 grid for any month). It
  has no events: they never leave the browser.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `/more-projects` is retired: `next.config.ts` redirects it (308) to https://bookchaowalit.com/.
