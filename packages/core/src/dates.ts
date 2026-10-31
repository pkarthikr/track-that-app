import type { DateString, Weekday } from "@trackthat/shared";

const MS_PER_DAY = 86_400_000;

function toUtcMs(date: DateString): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): DateString {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: DateString, days: number): DateString {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

export function weekdayOf(date: DateString): Weekday {
  return new Date(toUtcMs(date)).getUTCDay() as Weekday;
}

/** The Sunday on or before the given date. */
export function weekStart(date: DateString): DateString {
  return addDays(date, -weekdayOf(date));
}

export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}
