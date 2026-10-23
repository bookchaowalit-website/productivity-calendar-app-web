"use client";

import { useState } from "react";
import {
  STORAGE_KEY,
  WEEKDAYS,
  addEvent as addToList,
  countByDate,
  demoEvents,
  eventCountLabel,
  eventsOn,
  longDateLabel,
  monthLabel,
  monthMatrix,
  monthOf,
  parseEvents,
  removeEvent,
  shiftMonth,
  weekdayLabel,
  ymd,
  type CalEvent,
  type Month,
} from "@/lib/calendar";
import { useStoredState } from "@/lib/use-stored-state";

/** The month board and the selected-day panel for a known local date ("YYYY-MM-DD"). */
export function Board({ today }: { today: string }) {
  const [cursor, setCursor] = useState<Month>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  // null = nothing saved yet: show the demo event on today's date.
  const [stored, setStored] = useStoredState<CalEvent[] | null>(STORAGE_KEY, null, parseEvents);
  const events = stored ?? demoEvents(today);
  const setEvents = (update: (current: CalEvent[]) => CalEvent[]) => setStored((current) => update(current ?? demoEvents(today)));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const cells = monthMatrix(cursor);
  const counts = countByDate(events);
  const dayEvents = eventsOn(events, selected);
  const addEvent = () => { if (!title.trim()) return; setEvents((current) => addToList(current, selected, title, notes, crypto.randomUUID())); setTitle(""); setNotes(""); };
  const moveMonth = (delta: number) => setCursor((current) => shiftMonth(current, delta));
  const goToday = () => { setCursor(monthOf(today)); setSelected(today); };
  return <section className="board-layout" aria-label="Calendar workspace">
      <div className="calendar-board"><div className="board-toolbar"><h2>{monthLabel(cursor)}</h2><div className="board-buttons"><button className="board-button" type="button" onClick={() => moveMonth(-1)} aria-label="Prev month">Prev</button><button className="board-button" type="button" onClick={goToday}>Today</button><button className="board-button" type="button" onClick={() => moveMonth(1)} aria-label="Next month">Next</button></div></div><div className="weekday-row">{WEEKDAYS.map((day) => <span className="day-name" key={day}>{day}</span>)}</div><div className="day-grid">{cells.map((day) => { const key = ymd(day); const isSelected = key === selected; const isToday = key === today; const count = counts.get(key) ?? 0; return <button key={key} type="button" className={`day-cell ${day.getMonth() === cursor.month ? "" : "is-muted"} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`} onClick={() => setSelected(key)} aria-pressed={isSelected}><span className="day-number">{day.getDate()}</span><span className="sr-only">{` ${longDateLabel(key)}`}</span>{count > 0 ? <span className="cell-note"><span className="sr-only">, </span>{eventCountLabel(count)}</span> : null}{count > 0 ? <span className="event-tick" aria-hidden="true" /> : null}</button>; })}</div></div>
      <aside className="dispatch-panel"><div className="dispatch-kicker">Dispatch / selected date</div><h2>{weekdayLabel(selected)}</h2><div className="dispatch-date">{longDateLabel(selected)}</div><div className="event-list" aria-live="polite">{dayEvents.length ? dayEvents.map((event) => <article className="event-line" key={event.id}><header><h3>{event.title}</h3><button className="delete-button" type="button" onClick={() => setEvents((current) => removeEvent(current, event.id))}>Remove</button></header>{event.notes ? <p>{event.notes}</p> : null}</article>) : <p className="empty-state">No departures yet. Add the first event below.</p>}</div><form className="add-event" onSubmit={(event) => { event.preventDefault(); addEvent(); }}><h3>Add to this date</h3><input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title" aria-label="Event title" /><textarea className="field" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Event notes" rows={3} /><button className="dispatch-button" type="submit">Save event</button></form></aside>
    </section>;
}
