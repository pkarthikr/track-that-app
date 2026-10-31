import type { HabitRecord, HabitStore } from "./store";

export function createMemoryStore(): HabitStore {
  const habits = new Map<string, HabitRecord>();
  const completions = new Set<string>();

  const habitKey = (userId: string, habitId: string) => `${userId}\u0000${habitId}`;
  const completionKey = (userId: string, habitId: string, date: string) =>
    `${userId}\u0000${habitId}\u0000${date}`;

  return {
    async listHabits(userId) {
      const prefix = `${userId}\u0000`;
      return [...habits.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, habit]) => ({ ...habit }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
    async getHabit(userId, habitId) {
      const habit = habits.get(habitKey(userId, habitId));
      return habit && { ...habit };
    },
    async putHabit(userId, habit) {
      habits.set(habitKey(userId, habit.id), { ...habit });
    },
    async updateHabit(userId, habitId, changes) {
      const key = habitKey(userId, habitId);
      const existing = habits.get(key);
      if (!existing) return undefined;
      const updated = { ...existing, ...changes };
      habits.set(key, updated);
      return { ...updated };
    },
    async listCompletionDates(userId, habitId) {
      const prefix = completionKey(userId, habitId, "");
      return [...completions]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
        .sort();
    },
    async putCompletion(userId, habitId, date) {
      completions.add(completionKey(userId, habitId, date));
    },
    async deleteCompletion(userId, habitId, date) {
      completions.delete(completionKey(userId, habitId, date));
    },
  };
}
