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
  firstTitleByDate,
  gridKeyTarget,
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
// `scroll: false` keeps the page where the person left it (Undo expiring is not something they asked for).
type FocusTarget = ({ to: "remove"; id: string } | { to: "heading" } | { to: "day" } | { to: "cell"; key: string } | { to: "visible"; near: number }) & { scroll?: false };

// `viaKeyboard` picks the spoken hint; `focusUndo` hands focus to Undo because the focused Remove button is going away.
// `dayPos`: where the last removed event sat in the day's list, so an expiring Undo can hand focus to its neighbour.
type Removed = { items: { event: CalEvent; index: number }[]; viaKeyboard: boolean; focusUndo: boolean; dayPos: number };

/** Inside the viewport and below the sticky top bar (.as-top), so a focus ring there is seen without scrolling. */
function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  const barBottom = document.querySelector(".as-top")?.getBoundingClientRect().bottom ?? 0;
  return box.top >= barBottom && box.bottom <= (window.innerHeight || document.documentElement.clientHeight);
}

/** The month and the selected-day panel for a known local date ("YYYY-MM-DD"). */
export function Board({ today }: { today: string }) {
  const [cursor, setCursor] = useState<Month>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  // The day that holds the grid's single Tab stop (roving tabindex); arrow keys move it.
  const [focusKey, setFocusKey] = useState(today);
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
  const firstTitles = firstTitleByDate(events);
  // One Tab stop in the grid: the day arrow keys last reached, else the selected day, else the 1st, when shown.
  const shown = new Set(cells.map(ymd));
  const firstOfMonth = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`;
  const tabKey = [focusKey, selected].find((key) => shown.has(key)) ?? firstOfMonth;
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
    if (target.to === "visible") {
      // Undo expired with focus in it: the nearest Remove button left in the day list (next, then earlier ones),
      // then the day heading, then the selected day in the grid, whichever is on screen now. None on screen:
      // the heading, scrolled into view, so focus is never somewhere the person cannot see.
      const removes = [...(panelRef.current?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [])];
      const near = [...removes.slice(target.near), ...removes.slice(0, target.near).reverse()];
      const day = gridRef.current?.querySelector<HTMLElement>('.as-day[aria-pressed="true"]');
      const seen = [...near, headingRef.current, day].find((candidate): candidate is HTMLElement => Boolean(candidate && onScreen(candidate)));
      const chosen = seen ?? headingRef.current;
      chosen?.focus({ preventScroll: true });
      // "nearest" with the page's scroll-padding (top bar height) moves only as far as needed to clear the bar,
      // and not at all when the target is already in view.
      chosen?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (target.to === "remove") element = panelRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(target.id)}"]`);
    else if (target.to === "day") element = gridRef.current?.querySelector<HTMLElement>('.as-day[aria-pressed="true"]');
    else if (target.to === "cell") element = gridRef.current?.querySelector<HTMLElement>(`.as-day[data-date="${target.key}"]`);
    element = element ?? headingRef.current;
    element?.focus({ preventScroll: true });
    if (target.scroll !== false) element?.scrollIntoView?.({ block: "nearest" });
  }, [focusTick]);
  // Undo countdown model: it runs for six seconds from when the toast shows, and pauses while the
  // mouse is over the toast or the person is working in it: focus they moved there (Tab or
  // Shift+Tab back in) or any key they press inside it. Focus the app moves to Undo after a keyboard
  // Remove does not pause it by itself. Leaving the toast restarts the full six seconds.
  const autoFocusingUndo = useRef(false);
  useEffect(() => {
    if (!removed?.focusUndo) return;
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
      // Expiring with focus on Undo would drop it to <body>: hand it to something on screen near where the person
      // was (see the "visible" target), without scrolling when that is possible.
      if (toastRef.current?.contains(document.activeElement)) {
        focusTarget.current = { to: "visible", near: removed.dayPos };
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
    setFocusKey(key);
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
  function remove(item: CalEvent, viaKeyboard: boolean, focusUndo: boolean) {
    const index = events.findIndex((event) => event.id === item.id);
    setEvents((current) => removeEvent(current, item.id));
    const count = (removed?.items.length ?? 0) + 1;
    const dayPos = Math.max(0, dayEvents.findIndex((event) => event.id === item.id));
    setRemoved((current) => ({ items: [...(current?.items ?? []), { event: item, index }], viaKeyboard, focusUndo: viaKeyboard || focusUndo, dayPos }));
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
  // Arrow keys, Home/End and PageUp/PageDown move focus between days (switching month at the edges);
  // Enter or Space selects the focused day.
  function moveGridFocus(event: KeyboardEvent<HTMLButtonElement>, from: string) {
    // Ctrl/Cmd/Alt + Home/End (and other modified keys) stay with the browser, e.g. top or bottom of the page.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = gridKeyTarget(event.key, from, cursor);
    if (!target) return;
    event.preventDefault();
    if (!shown.has(target) || (event.key.startsWith("Page") && monthOf(target).month !== cursor.month)) setCursor(monthOf(target));
    setFocusKey(target);
    moveFocus({ to: "cell", key: target });
  }
  const moveMonth = (delta: number) => setCursor((current) => shiftMonth(current, delta));
  // Today also takes the grid's Tab stop, so Tab back into the month lands on today, not an older arrow-key spot.
  const goToday = () => { setCursor(monthOf(today)); setSelected(today); setFocusKey(today); announceDay(today); };
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => cells.slice(row * 7, row * 7 + 7));

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
            {/* A grid (rows of gridcells) so screen readers switch to focus mode and pass arrow keys to it.
                The rows and cells use display: contents (globals.css), so the 7-column layout is unchanged. */}
            <div className="as-days" ref={gridRef} role="grid" aria-label={`Days of ${monthLabel(cursor)}`} aria-describedby="grid-keys">
              <div role="row" className="as-sr">
                {WEEKDAYS.map((name, column) => <span role="columnheader" key={name} aria-label={weekdayLabel(ymd(cells[column]))}>{name}</span>)}
              </div>
              {weeks.map((week) => (
                <div role="row" className="cal-row" key={ymd(week[0])}>
                  {week.map((day) => {
                    const key = ymd(day);
                    const count = counts.get(key) ?? 0;
                    const isToday = key === today;
                    const firstTitle = firstTitles.get(key);
                    // The name carries the first event's title (shown on wide screens), so screen readers hear it
                    // and voice control can call the day by what it shows.
                    const events = count ? `, ${eventCountLabel(count)}${firstTitle ? `${count === 1 ? ":" : ", first:"} ${firstTitle}` : ""}` : "";
                    const label = `${weekdayLabel(key)}, ${longDateLabel(key)}${events}${isToday ? ", today" : ""}`;
                    return (
                      <div role="gridcell" className="cal-cell" key={key} aria-selected={key === selected}>
                        <button
                          type="button"
                          className="as-day"
                          data-outside={day.getMonth() === cursor.month ? undefined : "true"}
                          data-today={isToday ? "true" : undefined}
                          aria-pressed={key === selected}
                          aria-label={label}
                          data-date={key}
                          tabIndex={key === tabKey ? 0 : -1}
                          onKeyDown={(event) => { ignoreHeldKey(event); moveGridFocus(event, key); }}
                          onFocus={() => setFocusKey(key)}
                          onClick={() => select(key)}
                        >
                          <strong>{day.getDate()}</strong>
                          {count ? <span className="as-day-count" aria-hidden="true">{count}</span> : null}
                          {/* Wide screens (961px+) also show the first event's title; the label already names it. */}
                          {firstTitle ? <span className="as-day-title" aria-hidden="true">{firstTitle}</span> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="as-note as-cal-legend">The number under a date is how many events it holds. Today has a blue ring.</p>
          <p className="as-sr" id="grid-keys">Arrow keys move between days, Page Up and Page Down change the month, Enter opens the day.</p>
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
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${item.title}`} data-event-id={item.id} onKeyDown={ignoreHeldKey} onClick={(event) => remove(item, event.detail === 0, document.activeElement === event.currentTarget)}>Remove</button>
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
              <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is happening?" autoComplete="off" aria-required="true" aria-describedby="title-hint" />
            </label>
            {/* Says why Save event is not available yet; it changes once a title is typed. */}
            <p className="as-field-hint" id="title-hint">{title.trim() ? "Ready to save." : "Add a title to save."}</p>
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
