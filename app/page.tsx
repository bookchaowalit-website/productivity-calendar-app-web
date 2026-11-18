"use client";

import { Board } from "@/app/calendar-board";
import { AppFoot, AppTop } from "@/components/app-shell";
import { useToday } from "@/lib/use-today";

export default function Home() {
  // The date is only known in the browser, so the prerendered HTML shows a waiting card instead of a month.
  const today = useToday();
  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Calendar" tagline="Saved on this device · no sync" />
      {today ? <Board today={today} /> : (
        <main id="main" className="as-cal">
          <section className="as-cal-month" aria-labelledby="month-heading">
            <div className="as-head"><div><h1 id="month-heading">Calendar</h1><p>Loading your local date…</p></div></div>
            <div className="as-list as-empty"><strong>Opening your month</strong>The calendar opens in your browser, on your local date.</div>
          </section>
        </main>
      )}
      <p className="as-note as-cal-boundary">Events are saved in this browser only. This is not a shared calendar: nothing is sent, synced or seen by anyone else.</p>
      <AppFoot source="https://github.com/bookchaowalit-website/productivity-calendar-app-web" />
    </div>
  );
}
