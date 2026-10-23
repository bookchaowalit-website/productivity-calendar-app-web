import { describe, expect, it } from "vitest";
import {
  addEvent,
  countByDate,
  demoEvents,
  eventCountLabel,
  eventsOn,
  isDateKey,
  longDateLabel,
  monthLabel,
  monthMatrix,
  monthOf,
  parseEvents,
  parseYmd,
  removeEvent,
  shiftMonth,
  weekdayLabel,
  ymd,
} from "@/lib/calendar";

describe("date keys", () => {
  it("round-trips local dates and rejects impossible ones", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(parseYmd("2024-02-29")!)).toBe("2024-02-29");
    expect(parseYmd("2026-02-30")).toBeNull();
    expect(parseYmd("2026-2-3")).toBeNull();
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey(20260101)).toBe(false);
  });

  it("formats labels in en-US whatever the visitor's locale", () => {
    // Regression: toLocaleString(undefined) rendered "October 2026" on the server and "ตุลาคม 2569" in a Thai
    // browser, so hydration failed (React error 418).
    expect(monthLabel({ year: 2026, month: 9 })).toBe("October 2026");
    expect(weekdayLabel("2026-10-23")).toBe("Friday");
    expect(longDateLabel("2026-10-23")).toBe("October 23, 2026");
    expect(weekdayLabel("nope")).toBe("");
  });
});

describe("month navigation and grid", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(monthOf("2026-10-23")).toEqual({ year: 2026, month: 9 });
  });

  it("starts on the Sunday on or before the 1st and always has 42 days", () => {
    const grid = monthMatrix({ year: 2026, month: 9 }).map(ymd);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-27");
    expect(grid[4]).toBe("2026-10-01");
    expect(new Set(grid).size).toBe(42);
    expect(monthMatrix({ year: 2026, month: 1 }).map(ymd)[0]).toBe("2026-02-01");
  });
});

describe("events", () => {
  it("parses stored events and rejects corrupt, non-array or badly dated data", () => {
    expect(parseEvents(null)).toBeNull();
    expect(parseEvents("{oops")).toBeNull();
    // Regression: a stored object was cast to CalEvent[] and crashed events.filter().
    expect(parseEvents('{"demo":1}')).toBeNull();
    const good = { id: "a", date: "2026-10-23", title: "Call", notes: "" };
    expect(parseEvents(JSON.stringify([good, { ...good, id: "b", date: "2026-02-30" }, { id: "c" }]))).toEqual([good]);
    expect(parseEvents("[]")).toEqual([]);
  });

  it("adds trimmed events, ignores blank titles and bad dates, removes by id", () => {
    const start = demoEvents("2026-10-23");
    const added = addEvent(start, "2026-10-23", "  Dentist ", " 9am ", "x1");
    expect(added[1]).toEqual({ id: "x1", date: "2026-10-23", title: "Dentist", notes: "9am" });
    expect(addEvent(start, "2026-10-23", "  ", "n", "x2")).toBe(start);
    expect(addEvent(start, "2026-10-32", "Bad", "", "x3")).toBe(start);
    expect(removeEvent(added, "demo").map((e) => e.id)).toEqual(["x1"]);
  });

  it("filters and counts events per day", () => {
    const events = addEvent(addEvent(demoEvents("2026-10-23"), "2026-10-23", "Two", "", "b"), "2026-10-24", "Three", "", "c");
    expect(eventsOn(events, "2026-10-23").map((e) => e.id)).toEqual(["demo", "b"]);
    expect(countByDate(events).get("2026-10-23")).toBe(2);
    expect(countByDate(events).get("2026-10-25")).toBeUndefined();
    expect(eventCountLabel(1)).toBe("1 event");
    expect(eventCountLabel(2)).toBe("2 events");
  });
});
