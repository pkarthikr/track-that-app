import { describe, expect, it } from "vitest";

import { isHabitId, newHabitId } from "./ulid";

describe("newHabitId", () => {
  it("is 26 Crockford base32 characters", () => {
    const id = newHabitId(new Date("2026-10-30T12:00:00Z"));
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
  });

  it("sorts a later id after an earlier one", () => {
    const earlier = newHabitId(new Date("2026-10-30T12:00:00Z"), () => 0.99);
    const later = newHabitId(new Date("2026-10-30T12:00:01Z"), () => 0);
    expect(later > earlier).toBe(true);
  });

  it("uses the random source for the last 16 characters", () => {
    const id = newHabitId(new Date(0), () => 0);
    expect(id).toBe("0".repeat(26));
  });
});

describe("isHabitId", () => {
  it("accepts a generated id and rejects malformed values", () => {
    expect(isHabitId(newHabitId(new Date()))).toBe(true);
    for (const bad of ["h1", "", "a".repeat(2000), "I".repeat(26), 5, undefined]) {
      expect(isHabitId(bad)).toBe(false);
    }
  });
});
