import { describe, expect, it } from "vitest";

import { addDays, currentStreak, daysBetween, weekdayOf, weekStart } from "./index";

describe("core exports", () => {
  it("exports the date helpers and the streak rule", () => {
    for (const fn of [addDays, currentStreak, daysBetween, weekdayOf, weekStart]) {
      expect(fn).toBeTypeOf("function");
    }
  });
});
