import type { HabitColor } from "./palette";
import { WeekRow, type WeekDays } from "./WeekRow";
import "./HabitRow.css";

export function HabitRow({
  name,
  color,
  active,
  streak,
  days,
  todayIndex,
  pending = false,
  onOpen,
  onToggleDay,
}: {
  name: string;
  color: HabitColor;
  /** The habit is scheduled today. */
  active: boolean;
  streak: number;
  days: WeekDays;
  todayIndex: number;
  /** A write for this habit is in flight. */
  pending?: boolean;
  onOpen: () => void;
  onToggleDay: (index: number) => void;
}) {
  const done = days[todayIndex] === "done";
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
          disabled={pending}
          onClick={() => onToggleDay(todayIndex)}
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
        <button type="button" className="habit-row__name" onClick={onOpen}>
          {name}
        </button>
        {streak > 0 && <span className="habit-row__streak">{`Streak ${streak}`}</span>}
      </div>
      <div className="habit-row__week">
        <WeekRow days={days} color={color} todayIndex={todayIndex} onToggleDay={onToggleDay} />
      </div>
    </li>
  );
}
