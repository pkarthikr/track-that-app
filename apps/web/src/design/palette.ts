import { HABIT_COLORS } from "@trackthat/shared";
import type { HabitColor } from "@trackthat/shared";

export { HABIT_COLORS };
export type { HabitColor };

/** Steps 1-4 per colour; step 4 is "full". Mirrors tokens.css. */
export const palette: Record<HabitColor, readonly [string, string, string, string]> = {
  green: ["#ACE0BA", "#75C38D", "#3DA565", "#14804F"],
  teal: ["#95E1E1", "#44C5C6", "#00A3A4", "#007F81"],
  blue: ["#B3D4FF", "#80B4F5", "#5493E2", "#3273C2"],
  violet: ["#D1C9FF", "#B3A5F2", "#9682DF", "#7963C0"],
  pink: ["#F8BDD8", "#E795BC", "#D16FA0", "#B25083"],
  coral: ["#FFBFB8", "#F0968E", "#DB7069", "#BB504B"],
  orange: ["#F8C5A2", "#E89E6B", "#D17A37", "#B25A00"],
};

export function habitColor(color: HabitColor): string {
  return palette[color][3];
}
