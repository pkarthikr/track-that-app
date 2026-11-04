import { describe, expect, it } from "vitest";
import { weekCells } from "./week";

const habit = {
  weekdays: [1, 3, 5] as const,
  goal: 1,
  weekCounts: { "2026-10-26": 1, "2026-10-30": 1 },
};

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
    const { days } = weekCells(
      { weekdays: [1], goal: 1, weekCounts: { "2026-10-28": 1 } },
      "2026-10-30",
    );
    expect(days[3]).toBe("done");
  });

  it("reports the count for each day", () => {
    const { counts } = weekCells(
      { weekdays: [1, 3, 5], goal: 4, weekCounts: { "2026-10-28": 2, "2026-10-30": 4 } },
      "2026-10-30",
    );
    expect(counts).toEqual([0, 0, 0, 2, 0, 4, 0]);
  });

  it("marks a day short of the goal as partial and one at the goal as done", () => {
    const { days } = weekCells(
      { weekdays: [1, 3, 5], goal: 4, weekCounts: { "2026-10-28": 2, "2026-10-30": 4 } },
      "2026-10-30",
    );
    expect(days[3]).toBe("partial");
    expect(days[5]).toBe("done");
  });
});
