import type { HabitColor } from "../design/palette";
import type { DayState } from "../design/WeekRow";

export type PastWeek = readonly [DayState, DayState, DayState, DayState, DayState, DayState];

export type MockHabit = {
  id: string;
  name: string;
  color: HabitColor;
  /** Due today; inactive habits are still shown and can still be ticked. */
  active: boolean;
  /** Sunday to Friday. */
  past: PastWeek;
  /** What Saturday (today) shows until it is ticked. */
  today: Exclude<DayState, "done">;
};

/** Placeholder content until habits come from the user's account. */
export const MOCK_HABITS: readonly MockHabit[] = [
  {
    id: "read",
    name: "Read 20 pages",
    color: "blue",
    active: true,
    past: ["done", "done", "done", "done", "done", "done"],
    today: "open",
  },
  {
    id: "water",
    name: "Water the plants",
    color: "green",
    active: true,
    past: ["rest", "rest", "done", "rest", "rest", "rest"],
    today: "open",
  },
  {
    id: "gym",
    name: "Go to the gym",
    color: "coral",
    active: true,
    past: ["open", "done", "open", "done", "open", "open"],
    today: "open",
  },
  {
    id: "meditate",
    name: "Meditate 10 min",
    color: "violet",
    active: true,
    past: ["done", "done", "open", "done", "open", "open"],
    today: "open",
  },
  {
    id: "stretch",
    name: "Stretch",
    color: "teal",
    active: false,
    past: ["rest", "done", "rest", "done", "rest", "done"],
    today: "rest",
  },
  {
    id: "meal-prep",
    name: "Meal prep",
    color: "orange",
    active: false,
    past: ["done", "rest", "rest", "rest", "rest", "rest"],
    today: "rest",
  },
];
