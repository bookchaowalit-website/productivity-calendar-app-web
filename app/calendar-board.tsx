"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  STORAGE_KEY,
  WEEKDAYS,
  addEvent as addToList,
  countByDate,
  demoEvents,
  eventCountLabel,
  eventsOn,
  longDateLabel,
  monthDayLabel,
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
type FocusTarget = { to: "remove"; id: string } | { to: "heading" } | { to: "day" };

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
  // A mouse user aiming at Undo pauses the countdown just as focus does; leaving restarts it.
  const [toastHovered, setToastHovered] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Bumped when a day is picked on a stacked layout; the effect below then brings the panel into view.
  const [reveal, setReveal] = useState(0);
  // Where focus goes after the next render: a restored event's Remove button, the day heading, or the selected day.
  // Set in a handler, applied by the effect once the tick re-renders the board.
  const focusTarget = useRef<FocusTarget | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    let element: HTMLElement | null | undefined;
    if (target.to === "remove") element = panelRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(target.id)}"]`);
    else if (target.to === "day") element = gridRef.current?.querySelector<HTMLElement>('.as-day[aria-pressed="true"]');
    element = element ?? headingRef.current;
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "nearest" });
  }, [focusTick]);
  // Undo countdown model: it runs for six seconds from when the toast shows, and pauses while the
  // mouse is over the toast or the person is working in it: focus they moved there (Tab or
  // Shift+Tab back in) or any key they press inside it. Focus the app moves to Undo after a keyboard
  // Remove does not pause it by itself. Leaving the toast restarts the full six seconds.
  const autoFocusingUndo = useRef(false);
  useEffect(() => {
    if (!removed?.viaKeyboard) return;
    autoFocusingUndo.current = true;
    undoRef.current?.focus();
    autoFocusingUndo.current = false;
  }, [removed]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the page bottom,
  // so the last links can scroll clear of it and focus scrolling keeps the focused link above it.
  const toastShown = removed !== null;
  useEffect(() => {
    if (!toastShown) return;
    const root = document.documentElement;
    const height = toastRef.current?.getBoundingClientRect().height || 52;
    root.style.setProperty("--as-toast-space", `${Math.ceil(height) + 24 + 16}px`);
    root.setAttribute("data-toast", "");
    return () => {
      root.removeAttribute("data-toast");
      root.style.removeProperty("--as-toast-space");
    };
  }, [toastShown]);
  useEffect(() => {
    if (!removed || toastFocused || toastHovered) return;
    const timer = window.setTimeout(() => {
      // Expiring with focus on Undo would drop it to <body>: hand it to the day heading instead.
      if (toastRef.current?.contains(document.activeElement)) {
        focusTarget.current = { to: "heading" };
        setFocusTick((tick) => tick + 1);
      }
      setRemoved(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused, toastHovered]);

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
    // The day's new count makes each confirmation differ, so a repeat save is still announced.
    setAnnouncement(`Added “${title.trim()}” on ${longDateLabel(selected)}. ${eventCountLabel(dayEvents.length + 1)} that day.`);
    setTitle("");
    setNotes("");
    titleRef.current?.focus();
  }
  function remove(item: CalEvent, viaKeyboard: boolean) {
    const index = events.findIndex((event) => event.id === item.id);
    setEvents((current) => removeEvent(current, item.id));
    const count = (removed?.items.length ?? 0) + 1;
    setRemoved((current) => ({ items: [...(current?.items ?? []), { event: item, index }], viaKeyboard }));
    // Focus is now on Undo, so say how to stop the six-second countdown before the removal sticks:
    // any key pressed in the toast pauses it (see the countdown model above).
    const keepOpen = viaKeyboard ? " Press an arrow key to keep Undo open." : "";
    setAnnouncement((count === 1
      ? `Removed “${item.title}”. Undo is available for a few seconds.`
      : `Removed ${eventCountLabel(count)}. Undo restores ${count === 2 ? "both" : `all ${count}`}.`) + keepOpen);
  }
  // Focus never goes to a text field here: on phones that would open the keyboard.
  function moveFocus(target: FocusTarget) {
    focusTarget.current = target;
    setFocusTick((tick) => tick + 1);
  }
  function closeToast(focus: FocusTarget = { to: "heading" }) {
    setRemoved(null);
    setToastFocused(false);
    setToastHovered(false);
    moveFocus(focus);
  }
  // Narrow screens: the panel sits under the month, so offer a way back to the selected day.
  function backToDay() {
    if (!monthMatrix(cursor).some((day) => ymd(day) === selected)) setCursor(monthOf(selected));
    moveFocus({ to: "day" });
  }
  function undo() {
    if (!removed) return;
    const { items } = removed;
    setEvents((current) => items.reduceRight((list, { event, index }) => restoreEvent(list, event, index), current));
    setAnnouncement(items.length === 1 ? `Restored “${items[0].event.title}”.` : `Restored ${eventCountLabel(items.length)}.`);
    // The most recently removed event that is on the day shown, else the day heading.
    const onDay = [...items].reverse().find(({ event }) => event.date === selected);
    closeToast(onDay ? { to: "remove", id: onDay.event.id } : { to: "heading" });
  }
  // A held Enter repeats keydown, and each repeat would click the button that now has focus: Remove
  // moves focus to Undo and Undo back to Remove, so one long press could flip between them. The same
  // holds for "Back to …" (focus moves to the day button) and a day button (focus moves to the panel).
  function ignoreHeldKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
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
            <div className="as-days" ref={gridRef}>
              {cells.map((day) => {
                const key = ymd(day);
                const count = counts.get(key) ?? 0;
                const isToday = key === today;
                const label = `${weekdayLabel(key)}, ${longDateLabel(key)}${count ? `, ${eventCountLabel(count)}` : ""}${isToday ? ", today" : ""}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className="as-day"
                    data-outside={day.getMonth() === cursor.month ? undefined : "true"}
                    data-today={isToday ? "true" : undefined}
                    aria-pressed={key === selected}
                    aria-label={label}
                    onKeyDown={ignoreHeldKey}
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

        <aside className="as-panel" aria-labelledby="day-heading" ref={panelRef}>
          <div className="as-panel-head">
            <h2 id="day-heading" ref={headingRef} tabIndex={-1}>{weekdayLabel(selected)}</h2>
            <p>{longDateLabel(selected)}</p>
          </div>
          {/* After the heading in the DOM, so Tab from the focused heading reaches it next. */}
          <button type="button" className="as-plain as-back" onKeyDown={ignoreHeldKey} onClick={backToDay}>Back to {monthDayLabel(selected)}</button>
          {/* The toast is fixed on screen, but sits here in the DOM: Tab from Undo goes on to this day's
              remaining events and the composer instead of jumping to the footer. */}
          {removed ? (
            <div
              ref={toastRef}
              className="as-toast"
              role="group"
              aria-label="Undo remove"
              onFocus={() => { if (!autoFocusingUndo.current) setToastFocused(true); }}
              onMouseEnter={() => setToastHovered(true)}
              onMouseLeave={() => setToastHovered(false)}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeToast();
                else if (!event.repeat) setToastFocused(true);
              }}
            >
              <span>{removed.items.length === 1 ? `Removed “${removed.items[0].event.title}”` : `Removed ${eventCountLabel(removed.items.length)}`}</span>
              <button
                ref={undoRef}
                type="button"
                className="as-plain"
                aria-label={removed.items.length === 1 ? `Undo: restore ${removed.items[0].event.title}` : `Undo: restore ${eventCountLabel(removed.items.length)}`}
                onKeyDown={ignoreHeldKey}
                onClick={undo}
              >Undo</button>
            </div>
          ) : null}
          {dayEvents.length ? (
            <ul className="as-list" aria-label={`Events on ${longDateLabel(selected)}`}>
              {dayEvents.map((item) => (
                <li className="as-row as-row-event" key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    {item.notes ? <p>{item.notes}</p> : null}
                  </div>
                  {/* Keyboard removals, and clicks that focused this button, hand focus to Undo: the button is about to go. */}
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${item.title}`} data-event-id={item.id} onKeyDown={ignoreHeldKey} onClick={(event) => remove(item, event.detail === 0 || document.activeElement === event.currentTarget)}>Remove</button>
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
    </>
  );
}
