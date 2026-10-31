import { describe, expect, it } from "vitest";

import { isDateString, parseHabitPatch, parseNewHabit } from "./habits";

describe("isDateString", () => {
  it("accepts real dates including leap days", () => {
    expect(isDateString("2028-02-29")).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "2026-10-30T00:00", 20261030, null])(
    "rejects %s",
    (value) => {
      expect(isDateString(value)).toBe(false);
    },
  );
});

describe("parseNewHabit", () => {
  it("trims, deduplicates and sorts", () => {
    expect(parseNewHabit({ name: "  Gym ", color: "coral", weekdays: [5, 1, 3, 1] })).toEqual({
      ok: true,
      value: { name: "Gym", color: "coral", weekdays: [1, 3, 5] },
    });
  });

  it("accepts a 60 character name", () => {
    expect(parseNewHabit({ name: "a".repeat(60), color: "blue", weekdays: [0] }).ok).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "x"],
    ["empty name", { name: "", color: "blue", weekdays: [1] }],
    ["long name", { name: "a".repeat(61), color: "blue", weekdays: [1] }],
    ["bad color", { name: "Gym", color: "red", weekdays: [1] }],
    ["no weekdays", { name: "Gym", color: "blue", weekdays: [] }],
    ["weekday 7", { name: "Gym", color: "blue", weekdays: [7] }],
    ["weekday -1", { name: "Gym", color: "blue", weekdays: [-1] }],
    ["weekday 1.5", { name: "Gym", color: "blue", weekdays: [1.5] }],
    ["weekday string", { name: "Gym", color: "blue", weekdays: ["1"] }],
    ["missing name", { color: "blue", weekdays: [1] }],
    ["missing color", { name: "Gym", weekdays: [1] }],
    ["missing weekdays", { name: "Gym", color: "blue" }],
  ])("rejects %s", (_label, body) => {
    expect(parseNewHabit(body).ok).toBe(false);
  });
});

describe("parseHabitPatch", () => {
  it("accepts a trimmed name", () => {
    expect(parseHabitPatch({ name: " New " })).toEqual({ ok: true, value: { name: "New" } });
  });

  it("accepts a color", () => {
    expect(parseHabitPatch({ color: "blue" })).toEqual({ ok: true, value: { color: "blue" } });
  });

  it("accepts archived: true", () => {
    expect(parseHabitPatch({ archived: true })).toEqual({ ok: true, value: { archived: true } });
  });

  it.each([
    ["empty object", {}],
    ["weekdays", { weekdays: [1] }],
    ["archived false", { archived: false }],
    ["empty name", { name: "" }],
    ["unknown key", { extra: 1 }],
    ["null", null],
    ["array", []],
    ["string", "x"],
  ])("rejects %s", (_label, body) => {
    expect(parseHabitPatch(body).ok).toBe(false);
  });
});
