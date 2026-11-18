"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
  restoreEvent,
  shiftMonth,
  weekdayLabel,
  ymd,
  type CalEvent,
  type Month,
} from "@/lib/calendar";
import { useStoredState } from "@/lib/use-stored-state";

/** Below this width the day panel sits under the month, so picking a day scrolls to it (app-shell.css). */
export const STACKED_QUERY = "(max-width: 960px)";

const isStacked = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(STACKED_QUERY).matches);

// Every removal still inside the Undo window, oldest first. Undo restores them all, newest first, so each index
// is the position the event had when it was removed.
type Removed = { items: { event: CalEvent; index: number }[]; viaKeyboard: boolean };

/** The month and the selected-day panel for a known local date ("YYYY-MM-DD"). */
export function Board({ today }: { today: string }) {
  const [cursor, setCursor] = useState<Month>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  // null = nothing saved yet: show the demo event on today's date.
  const [stored, setStored] = useStoredState<CalEvent[] | null>(STORAGE_KEY, null, parseEvents);
  const events = stored ?? demoEvents(today);
  const setEvents = (update: (current: CalEvent[]) => CalEvent[]) => setStored((current) => update(current ?? demoEvents(today)));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Bumped when a day is picked on a stacked layout; the effect below then brings the panel into view.
  const [reveal, setReveal] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  const cells = monthMatrix(cursor);
  const counts = countByDate(events);
  const dayEvents = eventsOn(events, selected);
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-`;
  const monthCount = events.filter((event) => event.date.startsWith(monthPrefix)).length;

  useEffect(() => {
    if (!reveal) return;
    const heading = headingRef.current;
    if (!heading) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
    heading.focus({ preventScroll: true });
  }, [reveal]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  // Focus stays on the day button on wide screens, so say what the panel now shows.
  function announceDay(key: string) {
    const list = eventsOn(events, key);
    setAnnouncement(`${longDateLabel(key)}: ${list.length ? `${eventCountLabel(list.length)}: ${list.map((event) => event.title).join(", ")}` : "nothing planned"}`);
  }
  function select(key: string) {
    setSelected(key);
    announceDay(key);
    if (isStacked()) setReveal((count) => count + 1);
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setEvents((current) => addToList(current, selected, title, notes, crypto.randomUUID()));
    setAnnouncement(`Added “${title.trim()}” on ${longDateLabel(selected)}.`);
    setTitle("");
    setNotes("");
    titleRef.current?.focus();
  }
  function remove(item: CalEvent, viaKeyboard: boolean) {
    const index = events.findIndex((event) => event.id === item.id);
    setEvents((current) => removeEvent(current, item.id));
    const count = (removed?.items.length ?? 0) + 1;
    setRemoved((current) => ({ items: [...(current?.items ?? []), { event: item, index }], viaKeyboard }));
    setAnnouncement(count === 1
      ? `Removed “${item.title}”. Undo is available for a few seconds.`
      : `Removed ${eventCountLabel(count)}. Undo restores ${count === 2 ? "both" : `all ${count}`}.`);
  }
  function closeToast() {
    setRemoved(null);
    setToastFocused(false);
    titleRef.current?.focus();
  }
  function undo() {
    if (!removed) return;
    const { items } = removed;
    setEvents((current) => items.reduceRight((list, { event, index }) => restoreEvent(list, event, index), current));
    setAnnouncement(items.length === 1 ? `Restored “${items[0].event.title}”.` : `Restored ${eventCountLabel(items.length)}.`);
    closeToast();
  }
  const moveMonth = (delta: number) => setCursor((current) => shiftMonth(current, delta));
  const goToday = () => { setCursor(monthOf(today)); setSelected(today); announceDay(today); };

  return (
    <>
      <main id="main" className="as-cal">
        <section className="as-cal-month" aria-labelledby="month-heading">
          <div className="as-head">
            <div>
              <h1 id="month-heading">{monthLabel(cursor)}</h1>
              <p>{monthCount ? `${eventCountLabel(monthCount)} this month` : "No events this month"}</p>
            </div>
            <div className="as-tools as-cal-nav">
              <button type="button" className="as-plain" onClick={() => moveMonth(-1)} aria-label="Previous month">Prev</button>
              <button type="button" className="as-plain" onClick={goToday}>Today</button>
              <button type="button" className="as-plain" onClick={() => moveMonth(1)} aria-label="Next month">Next</button>
            </div>
          </div>
          <div className="as-month">
            <div className="as-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="as-days">
              {cells.map((day) => {
                const key = ymd(day);
                const count = counts.get(key) ?? 0;
                const isToday = key === today;
                const label = `${longDateLabel(key)}${isToday ? ", today" : ""}${count ? `, ${eventCountLabel(count)}` : ""}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className="as-day"
                    data-outside={day.getMonth() === cursor.month ? undefined : "true"}
                    data-today={isToday ? "true" : undefined}
                    aria-pressed={key === selected}
                    aria-label={label}
                    onClick={() => select(key)}
                  >
                    <strong>{day.getDate()}</strong>
                    {count ? <span className="as-day-count" aria-hidden="true">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="as-note as-cal-legend">The number under a date is how many events it holds. Today has a blue ring.</p>
        </section>

        <aside className="as-panel" aria-labelledby="day-heading">
          <div className="as-panel-head">
            <h2 id="day-heading" ref={headingRef} tabIndex={-1}>{weekdayLabel(selected)}</h2>
            <p>{longDateLabel(selected)}</p>
          </div>
          {dayEvents.length ? (
            <ul className="as-list" aria-label={`Events on ${longDateLabel(selected)}`}>
              {dayEvents.map((item) => (
                <li className="as-row as-row-event" key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    {item.notes ? <p>{item.notes}</p> : null}
                  </div>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${item.title}`} onClick={(event) => remove(item, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              <strong>Nothing planned</strong>Add the first event for this day below.
            </div>
          )}
          <form className="as-composer" onSubmit={add} aria-label="Add an event to this day">
            <label className="as-field">Event title
              <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is happening?" autoComplete="off" />
            </label>
            <label className="as-field">Notes (optional)
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Place, people, anything to remember" rows={3} />
            </label>
            <button type="submit" className="as-button" disabled={!title.trim()}>Save event</button>
          </form>
        </aside>
      </main>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removed.items.length === 1 ? `Removed “${removed.items[0].event.title}”` : `Removed ${eventCountLabel(removed.items.length)}`}</span>
          <button
            ref={undoRef}
            type="button"
            className="as-plain"
            aria-label={removed.items.length === 1 ? `Undo: restore ${removed.items[0].event.title}` : `Undo: restore ${eventCountLabel(removed.items.length)}`}
            onClick={undo}
          >Undo</button>
        </div>
      ) : null}
    </>
  );
}
