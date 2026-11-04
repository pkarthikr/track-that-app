import type { DateString, HabitColor, Weekday } from "@trackthat/shared";

export interface HabitRecord {
  id: string;
  name: string;
  color: HabitColor;
  weekdays: Weekday[];
  goal: number;
  createdAt: string;
  archivedAt?: string;
}

export interface Completion {
  date: DateString;
  count: number;
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
  /** Completions for the habit, ascending by date, across all pages. */
  listCompletions(userId: string, habitId: string): Promise<Completion[]>;
  /** Sets the number of completions on a day, replacing any earlier count. */
  putCompletion(userId: string, habitId: string, date: DateString, count: number): Promise<void>;
  deleteCompletion(userId: string, habitId: string, date: DateString): Promise<void>;
}
