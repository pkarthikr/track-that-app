import type { DateString, Weekday } from "@trackthat/shared";

import { addDays, weekdayOf } from "./dates";

export interface StreakInput {
  weekdays: readonly Weekday[];
  done: readonly DateString[];
  today: DateString;
}

/**
 * Consecutive scheduled days completed, ending today. Rest days neither break
 * nor extend the streak, and an unfinished scheduled today does not break it.
 */
export function currentStreak({ weekdays, done, today }: StreakInput): number {
  if (done.length === 0) return 0;

  const completed = new Set(done);
  // yyyy-mm-dd strings sort chronologically, so the lexical minimum is the earliest date.
  const earliest = done.reduce((min, date) => (date < min ? date : min));

  let streak = 0;
  let cursor = today;
  let isToday = true;

  while (cursor >= earliest) {
    if (weekdays.includes(weekdayOf(cursor))) {
      if (completed.has(cursor)) {
        streak += 1;
      } else if (!isToday) {
        break;
      }
    }
    isToday = false;
    cursor = addDays(cursor, -1);
  }

  return streak;
}
