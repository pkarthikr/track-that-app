import { addDays, weekdayOf } from "@trackthat/core";
import type { DateString, HabitColor } from "@trackthat/shared";
import "./Heatmap.css";

const DAYS = 365;

/**
 * The last 365 days ending today, in week columns (Sunday at the top). Read-only
 * and decorative: the container carries the accessible summary.
 */
export function Heatmap({
  color,
  done,
  today,
}: {
  color: HabitColor;
  done: readonly DateString[];
  today: DateString;
}) {
  const first = addDays(today, -(DAYS - 1));
  const dates: DateString[] = [];
  for (let i = 0; i < DAYS; i += 1) dates.push(addDays(first, i));
  const inWindow = new Set(dates);
  const completed = new Set(done.filter((date) => inWindow.has(date)));
  const count = completed.size;
  const label = `${count} ${count === 1 ? "completion" : "completions"} in the last 365 days`;
  const spacers = weekdayOf(first);

  return (
    <div className="heatmap">
      <div role="img" aria-label={label} className="heatmap__grid">
        {Array.from({ length: spacers }, (_, i) => (
          <span key={`spacer-${i}`} className="heatmap__spacer" />
        ))}
        {dates.map((date) =>
          completed.has(date) ? (
            <span
              key={date}
              data-date={date}
              data-done="true"
              className={`heatmap__cell habit-color--${color}`}
            />
          ) : (
            <span key={date} data-date={date} className="heatmap__cell" />
          ),
        )}
      </div>
    </div>
  );
}
