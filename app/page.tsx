"use client";

import { Board } from "@/app/calendar-board";
import { AppFoot, AppTop } from "@/components/app-shell";
import { WEEKDAYS } from "@/lib/calendar";
import { useToday } from "@/lib/use-today";

export default function Home() {
  // The date is only known in the browser, so the prerendered HTML shows a waiting card instead of a month.
  const today = useToday();
  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Calendar" tagline="Saved on this device · no sync" />
      {today ? <Board today={today} /> : (
        // Same footprint as the board (a 6 x 7 month and the day panel), so nothing jumps when it arrives.
        <main id="main" className="as-cal" aria-busy="true">
          <section className="as-cal-month" aria-labelledby="month-heading">
            <div className="as-head">
              <div><h1 id="month-heading">Calendar</h1><p>Opening your month on your local date…</p></div>
              {/* Same row as the board's Prev / Today / Next (full width at 760px and below), so the grid does not jump. */}
              <div className="as-tools as-cal-nav" aria-hidden="true">
                {["Prev", "Today", "Next"].map((name) => <button key={name} type="button" className="as-plain" disabled tabIndex={-1}>{name}</button>)}
              </div>
            </div>
            <div className="as-month as-month-skeleton" aria-hidden="true">
              <div className="as-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="as-days">{Array.from({ length: 42 }, (_, index) => <span key={index} className="as-day" />)}</div>
            </div>
            <p className="as-note as-cal-legend">The calendar opens in your browser, on your local date.</p>
            <noscript><p className="as-note">The calendar needs JavaScript: it runs in your browser so your events stay on this device.</p></noscript>
          </section>
          <div className="as-panel as-panel-skeleton" aria-hidden="true" />
        </main>
      )}
      <p className="as-note as-cal-boundary">Events are saved in this browser only. This is not a shared calendar: nothing is sent, synced or seen by anyone else.</p>
      <AppFoot source="https://github.com/bookchaowalit-website/productivity-calendar-app-web" />
    </div>
  );
}
