# Design direction

Since 2026-11-18 Calendar uses the shared App shell (`APP-SHELL.md`, `app/app-shell.css`): the calm, Apple-like look
of the other list-style apps, replacing the earlier "station departures board" theme (Sora, Roboto Mono, midnight
enamel and amber).

- Type and colour: Inter via `next/font`, `--as-*` tokens, light and dark from `prefers-color-scheme`.
- Layout: top bar → month (title, event count, Prev / Today / Next, 7-column day grid, legend) beside the
  selected-day panel (heading, events or "Nothing planned", labelled composer) → local-only note → footer back to
  https://bookchaowalit.com/. Below 960px the panel stacks under the month; picking a day scrolls to the panel and
  focuses its heading.
- Day cells: the habit-tracker day pattern (`.as-day`, `--as-field-line` edges), at least 52px tall on phones and
  72px on wider screens; a 12px count badge (`--as-accent` on `--as-surface`, 5.6:1 or better); today has a blue
  ring, the selected day is filled. The grid fits 320px without horizontal scroll.
- Remove is a 44px plain button named after the event, with a six-second Undo toast instead of a confirm dialog.
- Floor: text ≥ 12px, controls ≥ 44px tall, 4.5:1 text, 3:1 control edges, 3px focus ring.
- Content truth: events are localStorage-only and the seeded event is labelled as a portfolio demo event.
