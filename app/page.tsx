"use client";

import { Board } from "@/app/calendar-board";
import { useToday } from "@/lib/use-today";

export default function Home() {
  return <div className="station"><main className="station-shell">
    <header className="station-header"><div><div className="station-code">CALENDAR / LOCAL LINE</div><h1>Make room for the days that matter.</h1><p className="station-intro">A single-month planning board for events that belong to your own rhythm. Nothing leaves this browser.</p></div><div className="station-status">LOCAL / BROWSER ONLY</div></header>
    <CalendarWorkspace />
    <footer className="station-footer">Local events are saved in localStorage on this origin only. This portfolio boundary is not a shared calendar or a multi-user service.</footer>
  </main></div>;
}

function CalendarWorkspace() {
  const today = useToday();
  if (!today) return <section className="board-layout" aria-label="Calendar workspace"><div className="calendar-board"><p className="empty-state">The calendar opens in your browser, on your local date.</p></div></section>;
  return <Board today={today} />;
}
