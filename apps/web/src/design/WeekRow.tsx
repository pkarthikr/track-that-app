import type { HabitColor } from "./palette";
import "./WeekRow.css";

export type DayState = "done" | "open";
export type WeekDays = readonly [
  DayState,
  DayState,
  DayState,
  DayState,
  DayState,
  DayState,
  DayState,
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Sunday to Saturday; the last cell is today. */
export function WeekRow({ days, color }: { days: WeekDays; color: HabitColor }) {
  return (
    <div className="week-row">
      {days.map((state, i) => {
        const isToday = i === days.length - 1;
        const name = isToday ? `${DAY_NAMES[i]} (today)` : DAY_NAMES[i];
        const classes = ["week-row__cell", `week-row__cell--${state}`];
        if (state === "done") classes.push(`habit-color--${color}`);
        if (isToday) classes.push("week-row__cell--today");
        return (
          <div
            key={DAY_NAMES[i]}
            role="img"
            aria-label={`${name}: ${state === "done" ? "done" : "not done"}`}
            className={classes.join(" ")}
          >
            {DAY_LETTERS[i]}
          </div>
        );
      })}
    </div>
  );
}
