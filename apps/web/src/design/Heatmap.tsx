import { addDays, weekdayOf } from "@trackthat/core";
import type { DateString, DayCounts, HabitColor } from "@trackthat/shared";
import { useEffect, useRef } from "react";
import "./Heatmap.css";

const DAYS = 365;

/** 1 to 4: the share of the goal reached, rounded up, so any progress shows and a full day is 4. */
export function heatLevel(count: number, goal: number): number {
  if (count <= 0) return 0;
  return Math.min(4, Math.ceil((count / goal) * 4));
}

/**
 * The last 365 days ending today, in week columns (Sunday at the top). Read-only
 * and decorative: the container carries the accessible summary.
 */
export function Heatmap({
  color,
  counts,
  goal,
  today,
}: {
  color: HabitColor;
  /** Completions logged per day. */
  counts: DayCounts;
  /** Completions wanted per day; the darkest shade is a day that reached it. */
  goal: number;
  today: DateString;
}) {
  const first = addDays(today, -(DAYS - 1));
  const dates: DateString[] = [];
  for (let i = 0; i < DAYS; i += 1) dates.push(addDays(first, i));
  const inWindow = new Set(dates);
  const logged = Object.entries(counts).filter(([date, n]) => inWindow.has(date) && n > 0);
  const total = logged.reduce((sum, [, n]) => sum + n, 0);
  const label = `${total} ${total === 1 ? "completion" : "completions"} in the last 365 days`;
  const spacers = weekdayOf(first);
  const scroller = useRef<HTMLDivElement>(null);

  // The newest weeks are on the right; start there.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [today]);

  return (
    <div
      ref={scroller}
      className="heatmap"
      role="region"
      tabIndex={0}
      aria-label="Completion history, scrollable"
    >
      <div role="img" aria-label={label} className="heatmap__grid">
        {Array.from({ length: spacers }, (_, i) => (
          <span key={`spacer-${i}`} className="heatmap__spacer" />
        ))}
        {dates.map((date) => {
          const level = heatLevel(counts[date] ?? 0, goal);
          return level > 0 ? (
            <span
              key={date}
              data-date={date}
              data-level={level}
              data-done={level === 4 ? "true" : undefined}
              className={`heatmap__cell habit-color--${color}`}
            />
          ) : (
            <span key={date} data-date={date} className="heatmap__cell" />
          );
        })}
      </div>
    </div>
  );
}
