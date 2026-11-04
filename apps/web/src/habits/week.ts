import { addDays, weekdayOf, weekStart } from "@trackthat/core";
import type { DateString, DayCounts, Weekday } from "@trackthat/shared";
import type { DayState, WeekDays } from "../design/WeekRow";

/** The Sunday-to-Saturday week containing `today`, with a state per day. */
export function weekCells(
  habit: { weekdays: readonly Weekday[]; goal: number; weekCounts: DayCounts },
  today: DateString,
): {
  days: WeekDays;
  dates: readonly DateString[];
  counts: readonly number[];
  todayIndex: number;
} {
  const start = weekStart(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const counts = dates.map((date) => habit.weekCounts[date] ?? 0);
  const days = dates.map((date, i): DayState => {
    if (date > today) return "upcoming";
    const count = counts[i] ?? 0;
    if (count >= habit.goal) return "done";
    if (count > 0) return "partial";
    return habit.weekdays.includes(weekdayOf(date)) ? "open" : "rest";
  }) as unknown as WeekDays;
  return { days, dates, counts, todayIndex: dates.indexOf(today) };
}
