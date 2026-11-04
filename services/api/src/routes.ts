import { addDays, currentStreak, weekStart } from "@trackthat/core";
import type { DateString, DayCounts, HabitDetail, HabitSummary } from "@trackthat/shared";
import {
  isDateString,
  MAX_HABITS,
  parseCompletionCount,
  parseHabitPatch,
  parseNewHabit,
} from "@trackthat/shared";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

import { HttpError, json } from "./http";
import type { Completion, HabitRecord, HabitStore } from "./store";
import { isHabitId, newHabitId } from "./ulid";

export interface RouteContext {
  store: HabitStore;
  now: () => Date;
  userId: string;
  event: APIGatewayProxyEventV2WithJWTAuthorizer;
}

export type Route = (ctx: RouteContext) => Promise<Exclude<APIGatewayProxyResultV2, string>>;

const DETAIL_DAYS = 365;

function requireToday(ctx: RouteContext): DateString {
  const today = ctx.event.queryStringParameters?.today;
  if (!isDateString(today)) {
    throw new HttpError("invalid-request", "today must be a valid yyyy-mm-dd date");
  }
  return today;
}

/** The public shape of a habit: everything except `archivedAt`. */
function publicFields({ id, name, color, weekdays, goal, createdAt }: HabitRecord) {
  return { id, name, color, weekdays, goal, createdAt };
}

/** The dates whose count reached the goal. */
function reachedGoal(completions: readonly Completion[], goal: number): DateString[] {
  return completions.filter((c) => c.count >= goal).map((c) => c.date);
}

function countsOf(completions: readonly Completion[]): DayCounts {
  return Object.fromEntries(completions.map((c) => [c.date, c.count]));
}

async function listHabits(ctx: RouteContext) {
  const today = requireToday(ctx);
  const firstOfWeek = weekStart(today);
  const habits = (await ctx.store.listHabits(ctx.userId)).filter((h) => h.archivedAt === undefined);
  const summaries: HabitSummary[] = await Promise.all(
    habits.map(async (habit) => {
      const all = await ctx.store.listCompletions(ctx.userId, habit.id);
      const week = all.filter((c) => c.date >= firstOfWeek);
      return {
        ...publicFields(habit),
        streak: currentStreak({
          weekdays: habit.weekdays,
          done: reachedGoal(all, habit.goal),
          today,
        }),
        weekDone: reachedGoal(week, habit.goal),
        weekCounts: countsOf(week),
      };
    }),
  );
  return json(200, summaries);
}

function notFound(): HttpError {
  return new HttpError("not-found", "habit not found");
}

/** The active habit named by the `{id}` path parameter, or a 404. */
async function requireActiveHabit(ctx: RouteContext): Promise<HabitRecord> {
  const id = ctx.event.pathParameters?.id;
  if (!isHabitId(id)) throw notFound();
  const habit = await ctx.store.getHabit(ctx.userId, id);
  if (habit === undefined || habit.archivedAt !== undefined) throw notFound();
  return habit;
}

function parseBody(ctx: RouteContext): unknown {
  try {
    return JSON.parse(ctx.event.body ?? "");
  } catch {
    throw new HttpError("invalid-request", "body must be valid JSON");
  }
}

async function getHabit(ctx: RouteContext) {
  const today = requireToday(ctx);
  const habit = await requireActiveHabit(ctx);
  const all = await ctx.store.listCompletions(ctx.userId, habit.id);
  const first = addDays(today, -(DETAIL_DAYS - 1));
  const detail: HabitDetail = {
    ...publicFields(habit),
    streak: currentStreak({
      weekdays: habit.weekdays,
      done: reachedGoal(all, habit.goal),
      today,
    }),
    counts: countsOf(all.filter((c) => c.date >= first && c.date <= today)),
  };
  return json(200, detail);
}

async function createHabit(ctx: RouteContext) {
  const parsed = parseNewHabit(parseBody(ctx));
  if (!parsed.ok) throw new HttpError("invalid-request", parsed.message);
  const existing = await ctx.store.listHabits(ctx.userId);
  if (existing.length >= MAX_HABITS) {
    throw new HttpError("habit-limit", `at most ${MAX_HABITS} habits are allowed`);
  }
  const now = ctx.now();
  const habit: HabitRecord = {
    id: newHabitId(now),
    ...parsed.value,
    createdAt: now.toISOString(),
  };
  await ctx.store.putHabit(ctx.userId, habit);
  return json(201, publicFields(habit));
}

async function updateHabit(ctx: RouteContext) {
  const parsed = parseHabitPatch(parseBody(ctx));
  if (!parsed.ok) throw new HttpError("invalid-request", parsed.message);
  const habit = await requireActiveHabit(ctx);
  const { name, color, archived } = parsed.value;
  // Only keys that are present: stores differ in how they treat explicit undefined.
  const changes: Parameters<HabitStore["updateHabit"]>[2] = {};
  if (name !== undefined) changes.name = name;
  if (color !== undefined) changes.color = color;
  if (archived) changes.archivedAt = ctx.now().toISOString();
  const updated = await ctx.store.updateHabit(ctx.userId, habit.id, changes);
  if (updated === undefined) throw notFound();
  return json(200, publicFields(updated));
}

const MAX_DAYS_AHEAD = 1;
const MAX_DAYS_BACK = 366;

/** The validated completion date from the path, within the allowed window around today. */
function requireCompletionDate(ctx: RouteContext): DateString {
  const date = ctx.event.pathParameters?.date;
  if (!isDateString(date)) {
    throw new HttpError("invalid-request", "date must be a valid yyyy-mm-dd date");
  }
  const today = ctx.now().toISOString().slice(0, 10);
  if (date > addDays(today, MAX_DAYS_AHEAD) || date < addDays(today, -MAX_DAYS_BACK)) {
    throw new HttpError("invalid-request", "date is outside the allowed range");
  }
  return date;
}

async function putCompletion(ctx: RouteContext) {
  const date = requireCompletionDate(ctx);
  const habit = await requireActiveHabit(ctx);
  // No body means "done for the day": the full goal.
  const body = ctx.event.body ? parseBody(ctx) : undefined;
  const count = parseCompletionCount(body, habit.goal);
  if (!count.ok) throw new HttpError("invalid-request", count.message);
  await ctx.store.putCompletion(ctx.userId, habit.id, date, count.value);
  return { statusCode: 204 };
}

async function deleteCompletion(ctx: RouteContext) {
  const date = requireCompletionDate(ctx);
  const habit = await requireActiveHabit(ctx);
  await ctx.store.deleteCompletion(ctx.userId, habit.id, date);
  return { statusCode: 204 };
}

export const routes: Record<string, Route> = {
  "GET /habits": listHabits,
  "GET /habits/{id}": getHabit,
  "POST /habits": createHabit,
  "PATCH /habits/{id}": updateHabit,
  "PUT /habits/{id}/completions/{date}": putCompletion,
  "DELETE /habits/{id}/completions/{date}": deleteCompletion,
};
