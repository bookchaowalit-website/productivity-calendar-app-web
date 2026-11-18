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
    expect(day("November 18, 2026").getAttribute("aria-label")).toBe("Wednesday, November 18, 2026, 1 event, today");
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
    expect(day("November 20, 2026").getAttribute("aria-label")).toBe("Friday, November 20, 2026, 1 event");
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

  it("keeps the toast while it has focus", () => {
    vi.useFakeTimers();
    press($('[aria-label="Remove Portfolio demo event"]')!, 0);
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
    expect($('[role="status"]')!.textContent).toBe("Removed 2 events. Undo restores both.");
    expect(button("Undo").getAttribute("aria-label")).toBe("Undo: restore 2 events");
  });

  it("names three or more removals with 'all'", () => {
    for (const title of ["B", "C"]) { type(field("Event title"), title); press(button("Save event")); }
    for (const title of ["Portfolio demo event", "B", "C"]) press($(`[aria-label="Remove ${title}"]`)!, 0);
    expect($('[role="status"]')!.textContent).toBe("Removed 3 events. Undo restores all 3.");
  });

  it("the skip link target is the main landmark", () => {
    expect($('a.as-skip')!.getAttribute("href")).toBe("#main");
    expect($("main#main")).not.toBeNull();
  });
});

describe("review fixes (Codex round 3)", () => {
  it("day buttons name the weekday, the date, the count and today", () => {
    expect(day("November 18, 2026").getAttribute("aria-label")).toBe("Wednesday, November 18, 2026, 1 event, today");
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
