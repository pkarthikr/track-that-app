import { describe, expect, it } from "vitest";
import { todayLocal } from "./today";

describe("todayLocal", () => {
  it("uses the local date late in the day", () => {
    expect(todayLocal(new Date(2026, 9, 30, 23, 59))).toBe("2026-10-30");
  });

  it("uses the local date just after midnight", () => {
    expect(todayLocal(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
  });
});
