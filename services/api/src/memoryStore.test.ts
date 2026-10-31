import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memoryStore";
import type { HabitRecord } from "./store";

function habit(id: string, extra: Partial<HabitRecord> = {}): HabitRecord {
  return {
    id,
    name: `Habit ${id}`,
    color: "green",
    weekdays: [1, 3, 5],
    createdAt: "2026-10-30T00:00:00.000Z",
    ...extra,
  };
}

describe("memory store", () => {
  it("isolates habits per user", async () => {
    const store = createMemoryStore();
    await store.putHabit("a", habit("h1"));
    expect(await store.getHabit("b", "h1")).toBeUndefined();
    expect(await store.listHabits("b")).toEqual([]);
    expect(await store.getHabit("a", "h1")).toEqual(habit("h1"));
  });

  it("lists habits ascending by id, archived included", async () => {
    const store = createMemoryStore();
    await store.putHabit("a", habit("h2"));
    await store.putHabit("a", habit("h1", { archivedAt: "2026-10-30T01:00:00.000Z" }));
    const list = await store.listHabits("a");
    expect(list.map((h) => h.id)).toEqual(["h1", "h2"]);
  });

  it("updates a habit and returns it, or undefined when missing", async () => {
    const store = createMemoryStore();
    await store.putHabit("a", habit("h1"));
    const updated = await store.updateHabit("a", "h1", { name: "New", color: "blue" });
    expect(updated).toEqual(habit("h1", { name: "New", color: "blue" }));
    expect(await store.getHabit("a", "h1")).toEqual(updated);
    expect(await store.updateHabit("a", "nope", { name: "x" })).toBeUndefined();
    expect(await store.updateHabit("b", "h1", { name: "x" })).toBeUndefined();
  });

  it("stores a completion date once", async () => {
    const store = createMemoryStore();
    await store.putCompletion("a", "h1", "2026-10-30");
    await store.putCompletion("a", "h1", "2026-10-30");
    expect(await store.listCompletionDates("a", "h1")).toEqual(["2026-10-30"]);
  });

  it("resolves when deleting a missing completion", async () => {
    const store = createMemoryStore();
    await expect(store.deleteCompletion("a", "h1", "2026-10-30")).resolves.toBeUndefined();
  });

  it("deletes a completion", async () => {
    const store = createMemoryStore();
    await store.putCompletion("a", "h1", "2026-10-30");
    await store.deleteCompletion("a", "h1", "2026-10-30");
    expect(await store.listCompletionDates("a", "h1")).toEqual([]);
  });

  it("lists completion dates ascending, scoped to habit and user", async () => {
    const store = createMemoryStore();
    await store.putCompletion("a", "h1", "2026-10-30");
    await store.putCompletion("a", "h1", "2026-10-28");
    await store.putCompletion("a", "h2", "2026-10-01");
    await store.putCompletion("b", "h1", "2026-09-01");
    expect(await store.listCompletionDates("a", "h1")).toEqual(["2026-10-28", "2026-10-30"]);
  });
});
