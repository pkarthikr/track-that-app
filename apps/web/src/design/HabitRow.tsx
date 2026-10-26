import type { HabitColor } from "./palette";
import { WeekRow, type DayState, type WeekDays } from "./WeekRow";
import "./HabitRow.css";

type PastWeek = readonly [DayState, DayState, DayState, DayState, DayState, DayState];

export function HabitRow({
  name,
  color,
  active,
  done,
  past,
  today,
  onToggle,
}: {
  name: string;
  color: HabitColor;
  active: boolean;
  done: boolean;
  past: PastWeek;
  today: Exclude<DayState, "done">;
  onToggle: () => void;
}) {
  const days: WeekDays = [...past, done ? "done" : today];
  const classes = ["habit-row", `habit-color--${color}`];
  if (!active) classes.push("habit-row--inactive");
  if (done) classes.push("habit-row--done");

  return (
    <li className={classes.join(" ")}>
      <div className="habit-row__main">
        <button
          type="button"
          className="habit-row__check"
          aria-pressed={done}
          aria-label={`Mark ${name} done`}
          onClick={onToggle}
        >
          {done && (
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </button>
        <span className="habit-row__name">{name}</span>
      </div>
      <div className="habit-row__week">
        <WeekRow days={days} color={color} />
      </div>
    </li>
  );
}
