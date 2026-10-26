import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { HABIT_COLORS, habitColor, palette, type HabitColor } from "./palette";

const expected: Record<HabitColor, readonly string[]> = {
  green: ["#ACE0BA", "#75C38D", "#3DA565", "#14804F"],
  teal: ["#95E1E1", "#44C5C6", "#00A3A4", "#007F81"],
  blue: ["#B3D4FF", "#80B4F5", "#5493E2", "#3273C2"],
  violet: ["#D1C9FF", "#B3A5F2", "#9682DF", "#7963C0"],
  pink: ["#F8BDD8", "#E795BC", "#D16FA0", "#B25083"],
  coral: ["#FFBFB8", "#F0968E", "#DB7069", "#BB504B"],
  orange: ["#F8C5A2", "#E89E6B", "#D17A37", "#B25A00"],
};

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

describe("palette", () => {
  it("has seven colours in order", () => {
    expect(HABIT_COLORS).toEqual(["green", "teal", "blue", "violet", "pink", "coral", "orange"]);
    expect(HABIT_COLORS).toHaveLength(7);
  });

  it.each(HABIT_COLORS)("%s matches the spec table", (color) => {
    expect(palette[color]).toEqual(expected[color]);
  });

  it("habitColor returns step 4", () => {
    expect(habitColor("green")).toBe("#14804F");
    for (const color of HABIT_COLORS) {
      expect(habitColor(color)).toBe(expected[color][3]);
    }
  });

  it("tokens.css carries every hex under its matching name", () => {
    for (const color of HABIT_COLORS) {
      palette[color].forEach((hex, i) => {
        // Prettier lowercases hex in CSS, so compare case-insensitively.
        expect(css.toLowerCase()).toContain(`--habit-${color}-${i + 1}: ${hex.toLowerCase()};`);
      });
    }
  });

  it("tokens.css defines a habit-color utility class per colour", () => {
    for (const color of HABIT_COLORS) {
      expect(css).toMatch(
        new RegExp(
          `\\.habit-color--${color}\\s*\\{\\s*--habit:\\s*var\\(--habit-${color}-4\\);\\s*\\}`,
        ),
      );
    }
  });
});
