import { addDays, currentStreak, weekStart } from "@trackthat/core";
import type { DateString, HabitDetail, HabitSummary } from "@trackthat/shared";
import { isDateString } from "@trackthat/shared";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

import { HttpError, json } from "./http";
import type { HabitRecord, HabitStore } from "./store";

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
function publicFields({ id, name, color, weekdays, createdAt }: HabitRecord) {
  return { id, name, color, weekdays, createdAt };
}

async function listHabits(ctx: RouteContext) {
  const today = requireToday(ctx);
  const firstOfWeek = weekStart(today);
  const habits = (await ctx.store.listHabits(ctx.userId)).filter((h) => h.archivedAt === undefined);
  const summaries: HabitSummary[] = await Promise.all(
    habits.map(async (habit) => {
      const done = await ctx.store.listCompletionDates(ctx.userId, habit.id);
      return {
        ...publicFields(habit),
        streak: currentStreak({ weekdays: habit.weekdays, done, today }),
        weekDone: done.filter((d) => d >= firstOfWeek),
      };
    }),
  );
  return json(200, summaries);
}

async function getHabit(ctx: RouteContext) {
  const today = requireToday(ctx);
  const id = ctx.event.pathParameters?.id;
  const habit = id === undefined ? undefined : await ctx.store.getHabit(ctx.userId, id);
  if (habit === undefined || habit.archivedAt !== undefined) {
    throw new HttpError("not-found", "habit not found");
  }
  const all = await ctx.store.listCompletionDates(ctx.userId, habit.id);
  const first = addDays(today, -(DETAIL_DAYS - 1));
  const detail: HabitDetail = {
    ...publicFields(habit),
    streak: currentStreak({ weekdays: habit.weekdays, done: all, today }),
    done: all.filter((d) => d >= first && d <= today),
  };
  return json(200, detail);
}

export const routes: Record<string, Route> = {
  "GET /habits": listHabits,
  "GET /habits/{id}": getHabit,
};
