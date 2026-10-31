import { describe, expect, it } from "vitest";

import { addDays, daysBetween, weekdayOf, weekStart } from "./dates";

describe("dates", () => {
  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-30", -364)).toBe("2025-10-31");
  });

  it("returns the weekday with Sunday as 0", () => {
    expect(weekdayOf("2026-10-30")).toBe(5);
    expect(weekdayOf("2026-10-25")).toBe(0);
  });

  it("returns the Sunday on or before a date", () => {
    expect(weekStart("2026-10-30")).toBe("2026-10-25");
    expect(weekStart("2026-10-25")).toBe("2026-10-25");
    expect(weekStart("2027-01-01")).toBe("2026-12-27");
  });

  it("counts days between two dates", () => {
    expect(daysBetween("2026-10-25", "2026-10-30")).toBe(5);
  });
});
