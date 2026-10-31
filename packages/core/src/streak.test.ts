import { describe, expect, it } from "vitest";

import { addDays } from "./dates";
import { currentStreak } from "./streak";

const weekdays = [1, 3, 5] as const;
const today = "2026-10-30";
const everyDay = [0, 1, 2, 3, 4, 5, 6] as const;

describe("currentStreak", () => {
  it("counts consecutive scheduled days", () => {
    expect(
      currentStreak({ weekdays, done: ["2026-10-26", "2026-10-28", "2026-10-30"], today }),
    ).toBe(3);
  });

  it("does not break on an unfinished scheduled today", () => {
    expect(currentStreak({ weekdays, done: ["2026-10-26", "2026-10-28"], today })).toBe(2);
  });

  it("stops at a missed scheduled day", () => {
    expect(currentStreak({ weekdays, done: ["2026-10-26", "2026-10-30"], today })).toBe(1);
  });

  it("returns 0 when only an unscheduled day is done", () => {
    expect(currentStreak({ weekdays, done: ["2026-10-27"], today: "2026-10-28" })).toBe(0);
  });

  it("ignores completions on unscheduled days", () => {
    const base = ["2026-10-26", "2026-10-28", "2026-10-30"];
    expect(currentStreak({ weekdays, done: [...base, "2026-10-27", "2026-10-29"], today })).toBe(3);
  });

  it("returns 0 with no completions", () => {
    expect(currentStreak({ weekdays, done: [], today })).toBe(0);
  });

  it("counts a long every-day streak", () => {
    const done = Array.from({ length: 400 }, (_, i) => addDays(today, -i));
    expect(currentStreak({ weekdays: everyDay, done, today })).toBe(400);
  });

  it("counts across a year boundary", () => {
    const done = ["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"];
    expect(currentStreak({ weekdays: everyDay, done, today: "2026-01-02" })).toBe(4);
  });

  it("ignores order and duplicates in done", () => {
    const done = ["2026-10-30", "2026-10-26", "2026-10-28", "2026-10-28"];
    expect(currentStreak({ weekdays, done, today })).toBe(3);
  });
});
