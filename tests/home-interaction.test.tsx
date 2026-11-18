// @vitest-environment happy-dom
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
const day = (label: string) => host.querySelector(`.as-day[aria-label^="${label}"]`) as HTMLButtonElement;
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
    expect(day("November 18, 2026").getAttribute("aria-label")).toBe("November 18, 2026, today, 1 event");
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
    expect(day("November 20, 2026").getAttribute("aria-label")).toBe("November 20, 2026, 1 event");
    expect(document.activeElement).toBe(field("Event title"));
    expect(field("Event title").value).toBe("");
    expect(host.textContent).toContain("Added “Dentist” on November 20, 2026.");
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
    expect(document.activeElement).toBe(field("Event title"));
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
