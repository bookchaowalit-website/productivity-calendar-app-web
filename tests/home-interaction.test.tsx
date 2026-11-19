// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STORAGE_KEY } from "@/lib/calendar";
import { resetStoredCache } from "@/lib/use-stored-state";

// Mounted tests for the calendar on the App shell. The clock is pinned to Wed 18 Nov 2026.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
const day = (label: string) => host.querySelector(`.as-day[aria-label*="${label}"]`) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-panel .as-row h3")].map((h) => h.textContent);
const press = (el: Element, detail = 1) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const field = (label: string) => [...host.querySelectorAll(".as-field")].find((l) => l.textContent?.startsWith(label))!.querySelector("input, textarea") as HTMLInputElement;
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { date: string; title: string; notes: string }[] | null;
function mount() {
  root = createRoot(host);
  act(() => root.render(<Home />));
}
function stubWidth(stacked: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width") ? stacked : false, media: query, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 9, 0));
  localStorage.clear();
  resetStoredCache();
  stubWidth(false);
  host = document.createElement("div");
  document.body.append(host);
  mount();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("month and day selection", () => {
  it("opens on today's month with the demo event and footer links to the hub", () => {
    expect($("h1")!.textContent).toBe("November 2026");
    expect($("#day-heading")!.textContent).toBe("Wednesday");
    expect(rows()).toEqual(["Portfolio demo event"]);
    expect(day("November 18, 2026").getAttribute("aria-pressed")).toBe("true");
    expect(day("November 18, 2026").getAttribute("aria-label")).toBe("Wednesday, November 18, 2026, 1 event: Portfolio demo event, today");
    expect([...host.querySelectorAll(".as-foot a")].map((a) => a.getAttribute("href"))).toContain("https://bookchaowalit.com/");
  });

  it("selecting a day with nothing on it shows the empty state", () => {
    press(day("November 20, 2026"));
    expect($("#day-heading")!.textContent).toBe("Friday");
    expect($(".as-panel .as-empty")!.textContent).toContain("Nothing planned");
    expect(day("November 18, 2026").getAttribute("aria-pressed")).toBe("false");
  });

  it("Prev, Next and Today move the month", () => {
    press(button("Next"));
    expect($("h1")!.textContent).toBe("December 2026");
    press(button("Prev"));
    press(button("Prev"));
    expect($("h1")!.textContent).toBe("October 2026");
    expect($(".as-head p")!.textContent).toBe("No events this month");
    press(button("Today"));
    expect($("h1")!.textContent).toBe("November 2026");
    expect($(".as-head p")!.textContent).toBe("1 event this month");
  });
});

describe("revealing the panel on stacked layouts", () => {
  it("scrolls the day heading into view and focuses it when the panel sits under the month", () => {
    act(() => root.unmount());
    stubWidth(true);
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    mount();
    press(day("November 25, 2026"));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe($("#day-heading"));
    press(day("November 25, 2026"));
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("leaves focus on the day when the panel is already beside the month", () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    const cell = day("November 25, 2026");
    cell.focus();
    press(cell);
    expect(scroll).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell);
  });
});

describe("adding", () => {
  it("adds an event with visible labels, saves it and updates the day count", () => {
    press(day("November 20, 2026"));
    const save = button("Save event");
    expect(save.disabled).toBe(true);
    type(field("Event title"), "  Dentist  ");
    type(field("Notes (optional)"), "Bring the card");
    expect(save.disabled).toBe(false);
    press(save);
    expect(rows()).toEqual(["Dentist"]);
    expect($(".as-panel .as-row p")!.textContent).toBe("Bring the card");
    expect(stored()!.map((e) => [e.date, e.title, e.notes])).toEqual([["2026-11-18", "Portfolio demo event", "Click a day to add more."], ["2026-11-20", "Dentist", "Bring the card"]]);
    expect(day("November 20, 2026").getAttribute("aria-label")).toBe("Friday, November 20, 2026, 1 event: Dentist");
    expect(document.activeElement).toBe(field("Event title"));
    expect(field("Event title").value).toBe("");
    expect(host.textContent).toContain("Added “Dentist” on November 20, 2026. 1 event that day.");
  });

  it("announces a repeat save of the same title again, with the new day count", () => {
    const status = () => $('[role="status"]')!.textContent;
    press(day("November 20, 2026"));
    type(field("Event title"), "Gym");
    press(button("Save event"));
    expect(status()).toBe("Added “Gym” on November 20, 2026. 1 event that day.");
    type(field("Event title"), "Gym");
    press(button("Save event"));
    expect(status()).toBe("Added “Gym” on November 20, 2026. 2 events that day.");
  });

  it("loads events saved by the previous version under the same key", () => {
    act(() => root.unmount());
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "a", date: "2026-11-18", title: "Old event", notes: "" }]));
    resetStoredCache();
    mount();
    expect(rows()).toEqual(["Old event"]);
  });
});

describe("remove and undo", () => {
  it("Remove is labelled with the event, and Undo puts it back in place", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    expect(rows()).toEqual(["Second"]);
    expect(document.activeElement?.textContent).toBe("Undo");
    expect($(".as-toast")!.textContent).toContain("Removed “Portfolio demo event”");
    press(button("Undo"));
    expect(rows()).toEqual(["Portfolio demo event", "Second"]);
    expect(stored()!.map((e) => e.title)).toEqual(["Portfolio demo event", "Second"]);
    expect(document.activeElement).toBe($('[aria-label="Remove Portfolio demo event"]'));
  });

  it("Escape dismisses without restoring; a mouse removal times out after six seconds", () => {
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    expect($(".as-panel .as-empty")).not.toBeNull();
    expect(stored()).toEqual([]);

    type(field("Event title"), "Temp");
    press(button("Save event"));
    vi.useFakeTimers();
    press($('[aria-label="Remove Temp"]')!, 1);
    expect(document.activeElement?.textContent).not.toBe("Undo");
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("a click that focused Remove hands focus to Undo instead of losing it to the body", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    const remove = $<HTMLButtonElement>('[aria-label="Remove Portfolio demo event"]')!;
    act(() => { remove.focus(); }); // browsers that focus a button on click
    press(remove, 1);
    expect(remove.isConnected).toBe(false);
    expect(document.activeElement).toBe(button("Undo"));
  });

  it("puts Undo before the day's remaining events and composer in Tab order", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    const panel = $(".as-panel")!;
    const focusable = [...panel.querySelectorAll<HTMLElement>("button, input, textarea")].filter((el) => !(el as HTMLButtonElement).disabled);
    const undo = button("Undo");
    expect(panel.contains(undo)).toBe(true);
    const after = focusable.slice(focusable.indexOf(undo) + 1);
    expect(after[0]).toBe($('[aria-label="Remove Second"]'));
    expect(after).toContain(field("Event title"));
  });

  it("reserves the toast's height at the page bottom while it shows, then gives it back", () => {
    const html = document.documentElement;
    expect(html.hasAttribute("data-toast")).toBe(false);
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    expect(html.hasAttribute("data-toast")).toBe(true);
    // happy-dom has no layout, so the measured height falls back to the 52px toast: 52 + 24 + 16.
    expect(html.style.getPropertyValue("--as-toast-space")).toBe("92px");
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(html.hasAttribute("data-toast")).toBe(false);
    expect(html.style.getPropertyValue("--as-toast-space")).toBe("");
    const css = readFileSync("app/app-shell.css", "utf8");
    expect(css).toMatch(/html\[data-toast\] \{ scroll-padding-bottom: var\(--as-toast-space/);
    expect(css).toMatch(/html\[data-toast\] body \{ padding-bottom: var\(--as-toast-space/);
  });

  it("Undo still expires after Remove moved focus there itself, and focus goes to the day heading", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    expect(document.activeElement).toBe(button("Undo")); // the app's own focus move
    act(() => { vi.advanceTimersByTime(5999); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect($(".as-toast")).toBeNull();
    expect(document.activeElement).toBe($("#day-heading"));
  });

  it("Undo expiring moves focus to the day heading without scrolling the page", () => {
    vi.useFakeTimers();
    const scrolled: Element[] = [];
    const spy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: Element) { scrolled.push(this); });
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const remove = $<HTMLButtonElement>('[aria-label="Remove Portfolio demo event"]')!;
    act(() => { remove.focus(); });
    press(remove, 1);
    scrolled.length = 0;
    focus.mockClear();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(document.activeElement).toBe($("#day-heading"));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrolled).toEqual([]);
    spy.mockRestore();
    focus.mockRestore();
  });

  it("a clicked Remove that hands focus to Undo still expires after six seconds", () => {
    vi.useFakeTimers();
    const remove = $<HTMLButtonElement>('[aria-label="Remove Portfolio demo event"]')!;
    act(() => { remove.focus(); });
    press(remove, 1);
    expect(document.activeElement).toBe(button("Undo"));
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("a key pressed inside the toast after the auto-focus pauses the countdown", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { button("Undo").dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true })); });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect($(".as-toast")).not.toBeNull();
  });

  it("a keyboard removal says how to keep Undo open, and an arrow key does keep it open", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    expect($('[role="status"]')!.textContent).toBe("Removed “Portfolio demo event”. Undo is available for a few seconds. Press an arrow key to keep Undo open.");
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => { button("Undo").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect($(".as-toast")).not.toBeNull();
    press(button("Undo"));
    expect(rows()).toEqual(["Portfolio demo event"]);
  });

  it("a mouse removal does not get the keyboard hint", () => {
    press($('[aria-label="Remove Portfolio demo event"]')!, 1);
    expect($('[role="status"]')!.textContent).toBe("Removed “Portfolio demo event”. Undo is available for a few seconds.");
  });

  it("a held key's repeats do not count as working in the toast", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    act(() => { button("Undo").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true })); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("Tab back into the toast pauses it; Shift+Tab out restarts the full six seconds", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    const back = $<HTMLButtonElement>(".as-back")!;
    act(() => { button("Undo").dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })); });
    act(() => { back.focus(); }); // Shift+Tab lands on the control before Undo
    act(() => { vi.advanceTimersByTime(5000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("Undo").focus(); }); // Tab back in
    act(() => { vi.advanceTimersByTime(10_000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { back.focus(); });
    act(() => { vi.advanceTimersByTime(5999); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect($(".as-toast")).toBeNull();
  });

  it("a held Enter on Back to … or a day button cannot reopen the day panel; a fresh press still works", () => {
    const keydown = (el: Element, repeat: boolean) => {
      const event = new KeyboardEvent("keydown", { key: "Enter", repeat, bubbles: true, cancelable: true });
      act(() => { el.dispatchEvent(event); });
      return event.defaultPrevented;
    };
    const back = $<HTMLButtonElement>(".as-back")!;
    expect(keydown(back, true)).toBe(true);
    expect(keydown(back, false)).toBe(false);
    const cell = day("November 20, 2026");
    expect(keydown(cell, true)).toBe(true);
    expect(keydown(cell, false)).toBe(false);
  });

  it("a held Enter does not flip between Remove and Undo; a fresh press still works", () => {
    const keydown = (el: Element, repeat: boolean) => {
      const event = new KeyboardEvent("keydown", { key: "Enter", repeat, bubbles: true, cancelable: true });
      act(() => { el.dispatchEvent(event); });
      return event.defaultPrevented;
    };
    const remove = $('[aria-label="Remove Portfolio demo event"]')!;
    expect(keydown(remove, true)).toBe(true);
    expect(keydown(remove, false)).toBe(false);
    press(remove, 0);
    expect(keydown(button("Undo"), true)).toBe(true);
    expect(keydown(button("Undo"), false)).toBe(false);
  });

  it("keeps the toast while the person has moved focus into it, and restarts the countdown on leave", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 1); // a mouse removal: focus stays put
    act(() => { button("Undo").focus(); }); // the person tabs to Undo
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { (document.activeElement as HTMLElement).blur(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });
});

describe("review fixes (Codex, 2026-11-18)", () => {
  it("pauses the Undo countdown while the mouse is over the toast and restarts it on leave", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 1);
    expect(document.activeElement?.textContent).not.toBe("Undo");
    const toast = $(".as-toast")!;
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { toast.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body })); });
    act(() => { vi.advanceTimersByTime(10000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { toast.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect($(".as-toast")).toBeNull();
  });

  it("a hover left over from a closed toast does not pin the next one open", () => {
    vi.useFakeTimers();
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 1);
    act(() => { $(".as-toast")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body })); });
    press(button("Undo"), 1);
    press($('[aria-label="Remove Second"]')!, 1);
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });

  it("two removals inside the Undo window are both restored, in their old order", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    type(field("Event title"), "Third");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    press($('[aria-label="Remove Third"]')!, 0);
    expect(rows()).toEqual(["Second"]);
    expect($(".as-toast")!.textContent).toContain("Removed 2 events");
    press(button("Undo"));
    expect(rows()).toEqual(["Portfolio demo event", "Second", "Third"]);
    expect(stored()!.map((e) => e.title)).toEqual(["Portfolio demo event", "Second", "Third"]);
    expect(host.textContent).toContain("Restored 2 events.");
  });

  it("a removal after the toast expired starts a fresh Undo batch", () => {
    vi.useFakeTimers();
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 1);
    act(() => { vi.advanceTimersByTime(6000); });
    press($('[aria-label="Remove Second"]')!, 1);
    expect($(".as-toast")!.textContent).toContain("Removed “Second”");
    press(button("Undo"));
    expect(rows()).toEqual(["Second"]);
  });

  it("announces the selected day's events, or that nothing is planned, in the status region", () => {
    const status = () => $('[role="status"]')!.textContent;
    type(field("Event title"), "Dentist");
    press(button("Save event"));
    press(day("November 20, 2026"));
    expect(status()).toBe("November 20, 2026: nothing planned");
    press(day("November 18, 2026"));
    expect(status()).toBe("November 18, 2026: 2 events: Portfolio demo event, Dentist");
    press(day("November 20, 2026"));
    press(button("Today"));
    expect(status()).toBe("November 18, 2026: 2 events: Portfolio demo event, Dentist");
  });
});

describe("review fixes (Codex round 2)", () => {
  it("a batched removal announces the count and names Undo with it", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo: restore Portfolio demo event");
    press($('[aria-label="Remove Second"]')!, 0);
    expect($('[role="status"]')!.textContent).toBe("Removed 2 events. Undo restores both. Press an arrow key to keep Undo open.");
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo: restore 2 events");
  });

  it("names three or more removals with 'all'", () => {
    for (const title of ["B", "C"]) { type(field("Event title"), title); press(button("Save event")); }
    for (const title of ["Portfolio demo event", "B", "C"]) press($(`[aria-label="Remove ${title}"]`)!, 0);
    expect($('[role="status"]')!.textContent).toBe("Removed 3 events. Undo restores all 3. Press an arrow key to keep Undo open.");
  });

  it("the skip link target is the main landmark", () => {
    expect($('a.as-skip')!.getAttribute("href")).toBe("#main");
    expect($("main#main")).not.toBeNull();
  });
});

describe("review fixes (Codex round 3)", () => {
  it("day buttons name the weekday, the date, the count and today", () => {
    expect(day("November 18, 2026").getAttribute("aria-label")).toBe("Wednesday, November 18, 2026, 1 event: Portfolio demo event, today");
    expect(day("November 21, 2026").getAttribute("aria-label")).toBe("Saturday, November 21, 2026");
  });

  it("the panel's Back button returns focus to the selected day, switching back to its month if needed", () => {
    act(() => root.unmount());
    stubWidth(true);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    mount();
    press(day("November 20, 2026"));
    expect(document.activeElement).toBe($("#day-heading"));
    const back = button("Back to November 20");
    expect(back).toBeTruthy();
    // Next in the DOM after the heading block, so Tab from the focused heading reaches it.
    expect($("#day-heading")!.parentElement!.nextElementSibling).toBe(back);
    press(back);
    expect(document.activeElement).toBe(day("November 20, 2026"));
    press(button("Next"));
    press(button("Back to November 20"));
    expect($("h1")!.textContent).toBe("November 2026");
    expect(document.activeElement).toBe(day("November 20, 2026"));
  });

  it("Undo focuses the restored event's Remove button, never the title field", () => {
    type(field("Event title"), "Second");
    press(button("Save event"));
    press($('[aria-label="Remove Second"]')!, 1);
    press(button("Undo"));
    expect(document.activeElement).toBe($('[aria-label="Remove Second"]'));
    expect(document.activeElement).not.toBe(field("Event title"));
  });

  it("Undo focuses the day heading when the restored event is on another day; Escape does too", () => {
    press($('[aria-label="Remove Portfolio demo event"]')!, 1);
    press(day("November 20, 2026"));
    press(button("Undo"));
    expect(document.activeElement).toBe($("#day-heading"));
    press(day("November 18, 2026"));
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(document.activeElement).toBe($("#day-heading"));
  });
});

describe("review fixes (Codex round 4)", () => {
  it("day cells keep clear of the sticky top bar when scrolled into view", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/app/app-shell.css`, "utf8");
    expect(css).toMatch(/\.as-day \{ scroll-margin-top: 64px;/);
  });
});

describe("review 2026-11-18", () => {
  const key = (el: Element, k: string) => act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
  const tabStops = () => [...host.querySelectorAll<HTMLElement>(".as-day")].filter((d) => d.tabIndex === 0).map((d) => d.dataset.date);

  it("Page Up/Down move from the month shown, also from a neighbouring month's day in the grid", () => {
    const trailing = host.querySelector<HTMLButtonElement>('.as-day[data-date="2026-12-05"]')!; // in November's last row
    trailing.focus();
    key(trailing, "PageDown");
    expect($("h1")!.textContent).toBe("December 2026");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-12-05");
    key(document.activeElement!, "PageUp");
    expect($("h1")!.textContent).toBe("November 2026");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-05");
  });

  it("the month grid has one Tab stop; arrows, Home/End and PageUp/PageDown move focus, Enter selects", () => {
    expect(tabStops()).toEqual(["2026-11-18"]);
    const start = day("November 18, 2026");
    start.focus();
    key(start, "ArrowRight");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-19");
    expect(tabStops()).toEqual(["2026-11-19"]);
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-26");
    key(document.activeElement!, "Home");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-22");
    key(document.activeElement!, "End");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-28");
    // Selection does not follow focus.
    expect(day("November 18, 2026").getAttribute("aria-pressed")).toBe("true");
    key(document.activeElement!, "PageDown");
    expect($("h1")!.textContent).toBe("December 2026");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-12-28");
    for (let i = 0; i < 4; i += 1) key(document.activeElement!, "ArrowUp");
    // Nov 30 is drawn in December's first row, so the month stays.
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-30");
    expect($("h1")!.textContent).toBe("December 2026");
    key(document.activeElement!, "ArrowUp");
    expect($("h1")!.textContent).toBe("November 2026");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-23");
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-11-16");
    press(document.activeElement!, 0);
    expect($("#day-heading")!.textContent).toBe("Monday");
    expect(tabStops()).toEqual(["2026-11-16"]);
    expect($(".as-days")!.getAttribute("aria-describedby")).toBe("grid-keys");
  });

  it("Next month moves the Tab stop to a shown day", () => {
    press(button("Next"));
    press(button("Next"));
    expect(tabStops()).toEqual(["2027-01-01"]);
  });

  it("Save event explains why it is not available yet", () => {
    const input = field("Event title");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect($("#" + input.getAttribute("aria-describedby"))!.textContent).toBe("Add a title to save.");
    type(input, "Lunch");
    expect($("#title-hint")!.textContent).toBe("Ready to save.");
  });

  it("day cells carry the first event's title for wide screens", () => {
    expect(day("November 18, 2026").querySelector(".as-day-title")!.textContent).toBe("Portfolio demo event");
    expect(day("November 18, 2026").querySelector(".as-day-title")!.getAttribute("aria-hidden")).toBe("true");
    const css = readFileSync("app/app-shell.css", "utf8");
    expect(css).toMatch(/\.as-day-title \{ display: none; \}/);
    expect(css).toMatch(/@media \(min-width: 961px\) \{[^@]*\.as-day-title \{ display: block;[^}]*font-size: 12px/);
  });

  it("phones keep the tagline as a second line under the app name", () => {
    const css = readFileSync("app/app-shell.css", "utf8");
    expect(css).toMatch(/\.as-brand small \{ display: block; font-size: 12px; \}/);
  });
});

describe("deferred review 2026-11-19", () => {
  const tabStops = () => [...host.querySelectorAll<HTMLElement>(".as-day")].filter((d) => d.tabIndex === 0).map((d) => d.dataset.date);
  const keydown = (el: Element, init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    act(() => { el.dispatchEvent(event); });
    return event;
  };

  it("the month is a grid of rows and gridcells with weekday column headers", () => {
    const grid = $('[role="grid"]')!;
    expect(grid.getAttribute("aria-label")).toBe("Days of November 2026");
    const rowsEls = [...grid.querySelectorAll(':scope > [role="row"]')];
    expect(rowsEls).toHaveLength(7); // header row + 6 weeks
    expect([...rowsEls[0].querySelectorAll('[role="columnheader"]')].map((h) => h.getAttribute("aria-label"))).toEqual(
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    );
    for (const row of rowsEls.slice(1)) {
      const cellsInRow = [...row.children];
      expect(cellsInRow).toHaveLength(7);
      for (const cell of cellsInRow) {
        expect(cell.getAttribute("role")).toBe("gridcell");
        expect(cell.querySelector(".as-day")).not.toBeNull();
      }
    }
    expect(day("November 18, 2026").closest('[role="gridcell"]')!.getAttribute("aria-selected")).toBe("true");
    expect(day("November 19, 2026").closest('[role="gridcell"]')!.getAttribute("aria-selected")).toBe("false");
    // The wrappers take no box, so the day buttons stay items of the 7-column grid.
    expect(readFileSync("app/globals.css", "utf8")).toMatch(/\.cal-row, \.cal-cell \{ display: contents; \}/);
  });

  it("Today moves the grid's Tab stop back to today", () => {
    keydown(day("November 18, 2026"), { key: "ArrowRight" });
    expect(tabStops()).toEqual(["2026-11-19"]);
    press(button("Today"));
    expect(tabStops()).toEqual(["2026-11-18"]);
    // From another month as well.
    press(button("Next"));
    keydown(host.querySelector<HTMLElement>('.as-day[tabindex="0"]')!, { key: "ArrowRight" });
    press(button("Today"));
    expect(tabStops()).toEqual(["2026-11-18"]);
  });

  it("the selected day keeps a system-colour fill in forced-colors mode", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const block = css.slice(css.indexOf("@media (forced-colors: active)"));
    expect(block).toMatch(/\.as-day\[aria-pressed="true"\] \{ forced-color-adjust: none; border-color: Highlight; background: Highlight; color: HighlightText; \}/);
    expect(block).toMatch(/\.as-day\[data-today="true"\] \{ border: 2px solid CanvasText; \}/);
  });

  it("Ctrl/Cmd + Home and End are left to the browser", () => {
    const start = day("November 18, 2026");
    expect(keydown(start, { key: "Home", ctrlKey: true }).defaultPrevented).toBe(false);
    expect(keydown(start, { key: "End", metaKey: true }).defaultPrevented).toBe(false);
    expect(tabStops()).toEqual(["2026-11-18"]);
    expect(keydown(start, { key: "Home" }).defaultPrevented).toBe(true);
    expect(tabStops()).toEqual(["2026-11-15"]);
  });

  it("a mouse click on a focused Remove hands focus to Undo without the keyboard hint", () => {
    const remove = $<HTMLButtonElement>('[aria-label="Remove Portfolio demo event"]')!;
    act(() => { remove.focus(); }); // Chrome focuses a button on click
    press(remove, 1);
    expect($('[role="status"]')!.textContent).toBe("Removed “Portfolio demo event”. Undo is available for a few seconds.");
    expect(document.activeElement).toBe(button("Undo"));
  });
});
