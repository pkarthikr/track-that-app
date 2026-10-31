import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { DateString, HabitDetail as HabitDetailData } from "@trackthat/shared";
import { HabitsApiError } from "../habits/api";
import type { HabitsApi } from "../habits/api";
import { HabitDetail } from "./HabitDetail";

const TODAY = "2026-10-30" as DateString;

function habit(overrides: Partial<HabitDetailData> = {}): HabitDetailData {
  return {
    id: "h1",
    name: "Read",
    color: "teal",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    streak: 3,
    done: ["2026-10-30", "2026-10-29", "2026-10-28"],
    ...overrides,
  } as HabitDetailData;
}

function fakeApi(overrides: Partial<HabitsApi> = {}): HabitsApi {
  return {
    listHabits: vi.fn(),
    getHabit: vi.fn().mockResolvedValue(habit()),
    createHabit: vi.fn(),
    updateHabit: vi.fn().mockResolvedValue(habit()),
    logCompletion: vi.fn(),
    undoCompletion: vi.fn(),
    ...overrides,
  };
}

function setup(api: HabitsApi, id = "h1") {
  const onArchived = vi.fn();
  const view = render(
    <MemoryRouter>
      <HabitDetail api={api} id={id} today={TODAY} onArchived={onArchived} />
    </MemoryRouter>,
  );
  return { onArchived, ...view };
}

describe("HabitDetail", () => {
  it("shows a loading status, then the name, streak and heatmap", async () => {
    const api = fakeApi();
    setup(api);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "Read" })).toBeTruthy();
    expect(screen.getByText("Current streak: 3")).toBeTruthy();
    expect(screen.getByRole("img", { name: "3 completions in the last 365 days" })).toBeTruthy();
    expect(api.getHabit).toHaveBeenCalledWith("h1", TODAY);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows not found with a link home for a 404", async () => {
    const api = fakeApi({
      getHabit: vi.fn().mockRejectedValue(new HabitsApiError(404, "not_found", "nope")),
    });
    setup(api);
    expect(await screen.findByText("Habit not found.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /home/i }).getAttribute("href")).toBe("/home");
  });

  it("shows a retryable alert for other errors, including non-API ones", async () => {
    const getHabit = vi
      .fn()
      .mockRejectedValueOnce(new SyntaxError("bad json"))
      .mockResolvedValueOnce(habit());
    setup(fakeApi({ getHabit }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Read" })).toBeTruthy();
    expect(getHabit).toHaveBeenCalledTimes(2);
  });

  it("asks inline before archiving, and Cancel does not call the API", async () => {
    const api = fakeApi();
    setup(api);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Archive this habit?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByText("Archive this habit?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Archive this habit?")).toBeNull();
    expect(api.updateHabit).not.toHaveBeenCalled();
  });

  it("archives on confirm, disabling the button while in flight", async () => {
    let resolve!: () => void;
    const updateHabit = vi.fn(
      () =>
        new Promise<never>((r) => {
          resolve = () => r(undefined as never);
        }),
    );
    const { onArchived } = setup(fakeApi({ updateHabit }));
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(updateHabit).toHaveBeenCalledWith("h1", { archived: true });
    expect(
      (screen.getByRole("button", { name: "Confirm archive" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onArchived).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(onArchived).toHaveBeenCalledTimes(1));
  });

  it("shows an alert and keeps the screen when archiving fails", async () => {
    const updateHabit = vi.fn().mockRejectedValue(new Error("boom"));
    const { onArchived } = setup(fakeApi({ updateHabit }));
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Read" })).toBeTruthy();
    expect(onArchived).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Confirm archive" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("ignores a response that arrives after unmount", async () => {
    let resolve!: (value: HabitDetailData) => void;
    const getHabit = vi.fn(() => new Promise<HabitDetailData>((r) => (resolve = r)));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = setup(fakeApi({ getHabit }));
    unmount();
    resolve(habit());
    await Promise.resolve();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("uses only the latest request when the id changes", async () => {
    const resolvers: Record<string, (value: HabitDetailData) => void> = {};
    const getHabit = vi.fn(
      (id: string) => new Promise<HabitDetailData>((r) => (resolvers[id] = r)),
    );
    const api = fakeApi({ getHabit });
    const { rerender } = setup(api, "a");
    rerender(
      <MemoryRouter>
        <HabitDetail api={api} id="b" today={TODAY} onArchived={vi.fn()} />
      </MemoryRouter>,
    );
    resolvers.b?.(habit({ id: "b", name: "Second" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Second" })).toBeTruthy();
    resolvers.a?.(habit({ id: "a", name: "First" }));
    await Promise.resolve();
    expect(screen.getByRole("heading", { level: 1, name: "Second" })).toBeTruthy();
  });
});
