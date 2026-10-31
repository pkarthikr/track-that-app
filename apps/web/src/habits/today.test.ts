import { describe, expect, it } from "vitest";
import { todayLocal } from "./today";

// A Date-like value whose local fields disagree with its UTC view, so the test
// fails for an implementation that reads toISOString() or the UTC getters even
// when the runner itself is in UTC.
function stubDate(local: [number, number, number], iso: string): Date {
  const [year, month, day] = local;
  return {
    getFullYear: () => year,
    getMonth: () => month,
    getDate: () => day,
    toISOString: () => iso,
    getUTCFullYear: () => Number(iso.slice(0, 4)),
    getUTCMonth: () => Number(iso.slice(5, 7)) - 1,
    getUTCDate: () => Number(iso.slice(8, 10)),
  } as unknown as Date;
}

describe("todayLocal", () => {
  it("uses the local date late in the day", () => {
    expect(todayLocal(new Date(2026, 9, 30, 23, 59))).toBe("2026-10-30");
  });

  it("uses the local date just after midnight", () => {
    expect(todayLocal(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
  });

  it("ignores a UTC date that is already the next day", () => {
    const now = stubDate([2026, 9, 30], "2026-10-31T06:00:00.000Z");
    expect(todayLocal(now)).toBe("2026-10-30");
  });

  it("ignores a UTC date across the year boundary", () => {
    const now = stubDate([2026, 0, 1], "2025-12-31T20:00:00.000Z");
    expect(todayLocal(now)).toBe("2026-01-01");
  });
});
