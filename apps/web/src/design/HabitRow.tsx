import type { HabitColor } from "./palette";
import { WeekRow, type WeekDays } from "./WeekRow";
import "./HabitRow.css";

const RING_RADIUS = 20;

export function HabitRow({
  name,
  color,
  active,
  streak,
  goal = 1,
  count = 0,
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
  /** Completions wanted per day; above 1 the circle is tapped once per completion. */
  goal?: number;
  /** Completions logged today. */
  count?: number;
  days: WeekDays;
  todayIndex: number;
  /** A write for this habit is in flight. */
  pending?: boolean;
  onOpen: () => void;
  onToggleDay: (index: number) => void;
}) {
  const done = days[todayIndex] === "done";
  const counted = goal > 1;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const classes = ["habit-row", `habit-color--${color}`];
  if (!active) classes.push("habit-row--inactive");
  if (done) classes.push("habit-row--done");
  if (counted) classes.push("habit-row--counted");

  return (
    <li className={classes.join(" ")}>
      <div className="habit-row__main">
        <button
          type="button"
          className="habit-row__check"
          aria-pressed={counted ? undefined : done}
          aria-label={counted ? `Log ${name}: ${count} of ${goal}` : `Mark ${name} done`}
          disabled={pending}
          onClick={() => onToggleDay(todayIndex)}
        >
          {counted && !done && (
            <>
              <svg
                aria-hidden="true"
                className="habit-row__ring"
                width="44"
                height="44"
                viewBox="0 0 44 44"
              >
                <circle
                  cx="22"
                  cy="22"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(circumference * count) / goal} ${circumference}`}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <span className="habit-row__count" aria-hidden="true">
                {count}
              </span>
            </>
          )}
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
        {counted && <span className="habit-row__progress">{`${count}/${goal}`}</span>}
        {streak > 0 && <span className="habit-row__streak">{`Streak ${streak}`}</span>}
      </div>
      <div className="habit-row__week">
        <WeekRow days={days} color={color} todayIndex={todayIndex} onToggleDay={onToggleDay} />
      </div>
    </li>
  );
}
