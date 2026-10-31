import type { HabitColor } from "./palette";
import "./WeekRow.css";

/** "rest" is a day the habit is not scheduled; "upcoming" is after today. */
export type DayState = "done" | "open" | "rest" | "upcoming";
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
const STATE_LABELS: Record<DayState, string> = {
  done: "done",
  open: "not done",
  rest: "rest day",
  upcoming: "upcoming",
};
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/**
 * Sunday to Saturday. With `onToggleDay`, every cell that is not upcoming is a
 * button that reports its index.
 */
export function WeekRow({
  days,
  color,
  todayIndex = 6,
  onToggleDay,
}: {
  days: WeekDays;
  color: HabitColor;
  todayIndex?: number;
  onToggleDay?: (index: number) => void;
}) {
  return (
    <div className="week-row">
      {days.map((state, i) => {
        const isToday = i === todayIndex;
        const name = isToday ? `${DAY_NAMES[i]} (today)` : DAY_NAMES[i];
        const label = `${name}: ${STATE_LABELS[state]}`;
        const classes = ["week-row__cell", `week-row__cell--${state}`];
        if (state === "done") classes.push(`habit-color--${color}`);
        if (isToday) classes.push("week-row__cell--today");
        if (onToggleDay && state !== "upcoming") {
          classes.push("week-row__cell--button");
          return (
            <button
              key={DAY_NAMES[i]}
              type="button"
              aria-pressed={state === "done"}
              aria-label={label}
              className={classes.join(" ")}
              onClick={() => onToggleDay(i)}
            >
              {DAY_LETTERS[i]}
            </button>
          );
        }
        return (
          <div key={DAY_NAMES[i]} role="img" aria-label={label} className={classes.join(" ")}>
            {DAY_LETTERS[i]}
          </div>
        );
      })}
    </div>
  );
}
