import type { DateString, HabitColor, Weekday } from "@trackthat/shared";

export interface HabitRecord {
  id: string;
  name: string;
  color: HabitColor;
  weekdays: Weekday[];
  createdAt: string;
  archivedAt?: string;
}

export interface HabitStore {
  /** All habits for the user, archived included, ascending by id. */
  listHabits(userId: string): Promise<HabitRecord[]>;
  getHabit(userId: string, habitId: string): Promise<HabitRecord | undefined>;
  putHabit(userId: string, habit: HabitRecord): Promise<void>;
  /** Returns the updated habit, or undefined when the habit does not exist. */
  updateHabit(
    userId: string,
    habitId: string,
    changes: Partial<Pick<HabitRecord, "name" | "color" | "archivedAt">>,
  ): Promise<HabitRecord | undefined>;
  /** Completion dates for the habit, ascending, across all pages. */
  listCompletionDates(userId: string, habitId: string): Promise<DateString[]>;
  putCompletion(userId: string, habitId: string, date: DateString): Promise<void>;
  deleteCompletion(userId: string, habitId: string, date: DateString): Promise<void>;
}
