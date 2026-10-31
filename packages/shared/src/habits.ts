export const HABIT_COLORS = ["green", "teal", "blue", "violet", "pink", "coral", "orange"] as const;

export type HabitColor = (typeof HABIT_COLORS)[number];
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** A calendar date as `yyyy-mm-dd`. */
export type DateString = string;

export const MAX_HABITS = 50;
export const NAME_MAX_LENGTH = 60;

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  weekdays: Weekday[];
  createdAt: string;
}

export interface HabitSummary extends Habit {
  streak: number;
  weekDone: DateString[];
}

export interface HabitDetail extends Habit {
  streak: number;
  done: DateString[];
}

export interface NewHabit {
  name: string;
  color: HabitColor;
  weekdays: Weekday[];
}

export interface HabitPatch {
  name?: string;
  color?: HabitColor;
  archived?: true;
}

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(value: unknown): value is DateString {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHabitColor(value: unknown): value is HabitColor {
  return HABIT_COLORS.some((color) => color === value);
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

function parseName(value: unknown): Result<string> {
  if (typeof value !== "string") return { ok: false, message: "name must be a string" };
  const name = value.trim();
  if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
    return { ok: false, message: `name must be 1 to ${NAME_MAX_LENGTH} characters` };
  }
  return { ok: true, value: name };
}

export function parseNewHabit(body: unknown): Result<NewHabit> {
  if (!isRecord(body)) return { ok: false, message: "body must be an object" };

  const name = parseName(body.name);
  if (!name.ok) return name;

  if (!isHabitColor(body.color)) {
    return { ok: false, message: `color must be one of ${HABIT_COLORS.join(", ")}` };
  }

  const { weekdays } = body;
  if (!Array.isArray(weekdays) || weekdays.length === 0 || !weekdays.every(isWeekday)) {
    return { ok: false, message: "weekdays must be a non-empty list of integers 0 to 6" };
  }

  const unique = [...new Set<Weekday>(weekdays)].sort((a, b) => a - b);
  return { ok: true, value: { name: name.value, color: body.color, weekdays: unique } };
}

export function parseHabitPatch(body: unknown): Result<HabitPatch> {
  if (!isRecord(body)) return { ok: false, message: "body must be an object" };

  const keys = Object.keys(body);
  if (keys.length === 0) return { ok: false, message: "body must change something" };
  const unknown = keys.find((key) => key !== "name" && key !== "color" && key !== "archived");
  if (unknown !== undefined) return { ok: false, message: `unknown field: ${unknown}` };

  const patch: HabitPatch = {};

  if ("name" in body) {
    const name = parseName(body.name);
    if (!name.ok) return name;
    patch.name = name.value;
  }
  if ("color" in body) {
    if (!isHabitColor(body.color)) {
      return { ok: false, message: `color must be one of ${HABIT_COLORS.join(", ")}` };
    }
    patch.color = body.color;
  }
  if ("archived" in body) {
    if (body.archived !== true) return { ok: false, message: "archived must be true" };
    patch.archived = true;
  }

  return { ok: true, value: patch };
}
