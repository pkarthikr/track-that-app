import { describe, expect, it } from "vitest";
import { weekCells } from "./week";

const habit = { weekdays: [1, 3, 5] as const, weekDone: ["2026-10-26", "2026-10-30"] };

describe("weekCells", () => {
  it("maps a Friday week to day states", () => {
    const { days, dates, todayIndex } = weekCells(habit, "2026-10-30");
    expect(days).toEqual(["rest", "done", "rest", "open", "rest", "done", "upcoming"]);
    expect(dates[0]).toBe("2026-10-25");
    expect(dates[6]).toBe("2026-10-31");
    expect(todayIndex).toBe(5);
  });

  it("makes every later day upcoming on a Sunday", () => {
    const { days, todayIndex } = weekCells(habit, "2026-10-25");
    expect(todayIndex).toBe(0);
    expect(days.slice(1)).toEqual(Array(6).fill("upcoming"));
    expect(days[0]).toBe("rest");
  });

  it("shows a completion on an unscheduled day as done", () => {
    const { days } = weekCells({ weekdays: [1], weekDone: ["2026-10-28"] }, "2026-10-30");
    expect(days[3]).toBe("done");
  });
});
