// Calendar data and pure date logic, shared by the page and the MCP route.
// Dates are local calendar days written as "YYYY-MM-DD". Labels use en-US so the server and browser agree.

export type CalEvent = { id: string; date: string; title: string; notes: string };
export type Month = { year: number; month: number }; // month is 0-11

export const STORAGE_KEY = "calendar-app-events-v1";
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOCALE = "en-US";

export function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parse "YYYY-MM-DD" to a local Date at noon, or null when it is not a real calendar day. */
export function parseYmd(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day, 12);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && parseYmd(value) !== null;
}

export function monthOf(key: string): Month {
  const date = parseYmd(key) ?? new Date(NaN);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** 6 weeks x 7 days starting on the Sunday on or before the 1st. */
export function monthMatrix({ year, month }: Month): Date[] {
  const first = new Date(year, month, 1, 12);
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - first.getDay() + index, 12));
}

export function monthLabel({ year, month }: Month): string {
  return new Date(year, month, 1, 12).toLocaleString(LOCALE, { month: "long", year: "numeric" });
}

export function weekdayLabel(key: string): string {
  return parseYmd(key)?.toLocaleDateString(LOCALE, { weekday: "long" }) ?? "";
}

export function longDateLabel(key: string): string {
  return parseYmd(key)?.toLocaleDateString(LOCALE, { year: "numeric", month: "long", day: "numeric" }) ?? "";
}

export function demoEvents(todayKey: string): CalEvent[] {
  return [{ id: "demo", date: todayKey, title: "Portfolio demo event", notes: "Click a day to add more." }];
}

function isEvent(value: unknown): value is CalEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && isDateKey(item.date) && typeof item.title === "string" && typeof item.notes === "string";
}

/** Parse stored events. Returns null (show the demo event) for missing, corrupt or non-array data. */
export function parseEvents(raw: string | null): CalEvent[] | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return Array.isArray(value) ? value.filter(isEvent) : null;
}

export function eventsOn(events: CalEvent[], key: string): CalEvent[] {
  return events.filter((event) => event.date === key);
}

export function countByDate(events: CalEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  return counts;
}

/** Append a trimmed event; a blank title or an invalid date adds nothing (returns the same list). */
export function addEvent(events: CalEvent[], date: string, title: string, notes: string, id: string): CalEvent[] {
  if (!title.trim() || !isDateKey(date)) return events;
  return [...events, { id, date, title: title.trim(), notes: notes.trim() }];
}

export function removeEvent(events: CalEvent[], id: string): CalEvent[] {
  return events.filter((event) => event.id !== id);
}

export function eventCountLabel(count: number): string {
  return `${count} event${count === 1 ? "" : "s"}`;
}
