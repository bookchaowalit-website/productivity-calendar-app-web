"use client";

import { useSyncExternalStore } from "react";
import { ymd } from "@/lib/calendar";

const noop = () => () => {};

/**
 * Today's local date as "YYYY-MM-DD" in the browser, and null on the server and during hydration.
 * The page is prerendered at build time, so reading the clock while rendering there would bake the build day
 * into the HTML and make the browser's first render disagree with it.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noop, () => ymd(new Date()), () => null);
}
