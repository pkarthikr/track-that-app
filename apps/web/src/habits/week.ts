import { addDays, weekdayOf, weekStart } from "@trackthat/core";
import type { DateString, Weekday } from "@trackthat/shared";
import type { DayState, WeekDays } from "../design/WeekRow";

/** The Sunday-to-Saturday week containing `today`, with a state per day. */
export function weekCells(
  habit: { weekdays: readonly Weekday[]; weekDone: readonly DateString[] },
  today: DateString,
): { days: WeekDays; dates: readonly DateString[]; todayIndex: number } {
  const start = weekStart(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const days = dates.map((date): DayState => {
    if (date > today) return "upcoming";
    if (habit.weekDone.includes(date)) return "done";
    return habit.weekdays.includes(weekdayOf(date)) ? "open" : "rest";
  }) as unknown as WeekDays;
  return { days, dates, todayIndex: dates.indexOf(today) };
}
