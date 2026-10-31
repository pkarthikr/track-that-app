import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Habit } from "@trackthat/shared";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { HabitsApi } from "../habits/api";
import { AddHabit } from "./AddHabit";

const SATURDAY = 6;

const CREATED: Habit = {
  id: "h1",
  name: "Gym",
  color: "coral",
  weekdays: [1, 3, 5],
  createdAt: "2026-10-30T00:00:00.000Z",
};

function fakeApi(): HabitsApi {
  return {
    listHabits: vi.fn(),
    getHabit: vi.fn(),
    createHabit: vi.fn().mockResolvedValue(CREATED),
    updateHabit: vi.fn(),
    logCompletion: vi.fn(),
    undoCompletion: vi.fn(),
  };
}

function renderAddHabit(api: HabitsApi = fakeApi(), today = SATURDAY) {
  render(
    <MemoryRouter>
      <AddHabit api={api} today={today} />
    </MemoryRouter>,
  );
  return api;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const addButton = () => screen.getByRole("button", { name: "Add habit" }) as HTMLButtonElement;
const nameInput = () => screen.getByLabelText("What do you want to track?") as HTMLInputElement;

function fillIn(name: string, ...days: string[]) {
  fireEvent.change(screen.getByLabelText("What do you want to track?"), {
    target: { value: name },
  });
  for (const day of days) fireEvent.click(screen.getByRole("button", { name: day }));
}

describe("AddHabit", () => {
  it("has a New habit heading and a Home link back", () => {
    renderAddHabit();
    expect(screen.getByRole("heading", { level: 1, name: "New habit" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/home");
  });

  it("offers seven days and seven colours, none of the days picked", () => {
    renderAddHabit();
    const days = within(screen.getByRole("group", { name: "Which days?" })).getAllByRole("button");
    expect(days).toHaveLength(7);
    expect(days.every((day) => day.getAttribute("aria-pressed") === "false")).toBe(true);
    const colours = within(screen.getByRole("group", { name: "Color" })).getAllByRole("button");
    expect(colours).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Green" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("toggles days and picks one colour at a time", () => {
    renderAddHabit();
    const monday = screen.getByRole("button", { name: "Monday" });
    fireEvent.click(monday);
    expect(monday.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(monday);
    expect(monday.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Violet" }));
    expect(screen.getByRole("button", { name: "Violet" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Green" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("keeps Add habit disabled until there is a name and a day", () => {
    renderAddHabit();
    const add = screen.getByRole("button", { name: "Add habit" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fillIn("Go for a run");
    expect(add.disabled).toBe(true);
    fillIn("", "Tuesday");
    expect(add.disabled).toBe(true);
    fillIn("  Go for a run  ");
    expect(add.disabled).toBe(false);
  });

  it("confirms the habit and says it is due today", async () => {
    renderAddHabit();
    fillIn("Go for a run", "Saturday");
    fireEvent.click(addButton());
    const dialog = await screen.findByRole("dialog", { name: "Added" });
    expect(within(dialog).getByText("Go for a run")).toBeTruthy();
    expect(within(dialog).getByText("Due today")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe(
      "/home",
    );
  });

  it("names the next due day when today is not one", async () => {
    renderAddHabit();
    fillIn("Stretch", "Tuesday", "Thursday");
    fireEvent.click(addButton());
    expect(await screen.findByText("Next: Tue")).toBeTruthy();
  });

  it("does not show the confirmation before the form is submitted", () => {
    renderAddHabit();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates the habit with the typed name, chosen colour and ascending weekdays", async () => {
    const api = renderAddHabit();
    fillIn("Gym");
    fireEvent.click(screen.getByRole("button", { name: "Coral" }));
    for (const day of ["Friday", "Monday", "Wednesday"]) {
      fireEvent.click(screen.getByRole("button", { name: day }));
    }
    fireEvent.click(addButton());
    await screen.findByRole("dialog", { name: "Added" });
    expect(api.createHabit).toHaveBeenCalledTimes(1);
    expect(api.createHabit).toHaveBeenCalledWith({
      name: "Gym",
      color: "coral",
      weekdays: [1, 3, 5],
    });
  });

  it("shows the Added dialog with the habit name only after the request succeeds", async () => {
    const api = fakeApi();
    const request = deferred<Habit>();
    vi.mocked(api.createHabit).mockReturnValueOnce(request.promise);
    renderAddHabit(api);
    fillIn("Gym", "Monday");
    fireEvent.click(addButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      request.resolve(CREATED);
    });
    const dialog = await screen.findByRole("dialog", { name: "Added" });
    expect(within(dialog).getByText("Gym")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole("link", { name: "Back to Home" }),
      ),
    );
  });

  it("keeps the form, re-enables the button and shows a generic alert when the request fails", async () => {
    const api = fakeApi();
    vi.mocked(api.createHabit).mockRejectedValueOnce(new Error("secret 500 detail"));
    renderAddHabit(api);
    fillIn("Gym", "Monday", "Friday");
    fireEvent.click(screen.getByRole("button", { name: "Coral" }));
    fireEvent.click(addButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Couldn't add the habit. Try again.");
    expect(screen.queryByText(/secret 500 detail/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(nameInput().value).toBe("Gym");
    expect(screen.getByRole("button", { name: "Monday" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Friday" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Coral" }).getAttribute("aria-pressed")).toBe("true");
    expect(addButton().disabled).toBe(false);
  });

  it("clears the alert on the next attempt, which can then succeed", async () => {
    const api = fakeApi();
    vi.mocked(api.createHabit).mockRejectedValueOnce(new Error("boom"));
    renderAddHabit(api);
    fillIn("Gym", "Monday");
    fireEvent.click(addButton());
    await screen.findByRole("alert");

    const retry = deferred<Habit>();
    vi.mocked(api.createHabit).mockReturnValueOnce(retry.promise);
    fireEvent.click(addButton());
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      retry.resolve(CREATED);
    });
    expect(await screen.findByRole("dialog", { name: "Added" })).toBeTruthy();
    expect(api.createHabit).toHaveBeenCalledTimes(2);
  });

  it("disables the button while saving and sends one request for a repeated submit", async () => {
    const api = fakeApi();
    const request = deferred<Habit>();
    vi.mocked(api.createHabit).mockReturnValueOnce(request.promise);
    renderAddHabit(api);
    fillIn("Gym", "Monday");

    fireEvent.click(addButton());
    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    expect(api.createHabit).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(CREATED);
    });
    await screen.findByRole("dialog", { name: "Added" });
    expect(api.createHabit).toHaveBeenCalledTimes(1);
  });

  it("submits with Enter in the name field", async () => {
    const api = renderAddHabit();
    fillIn("Gym", "Monday");
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    await screen.findByRole("dialog", { name: "Added" });
    expect(api.createHabit).toHaveBeenCalledTimes(1);
  });

  it("shows the validator message for a too-long name and sends nothing", () => {
    const api = renderAddHabit();
    fillIn("x".repeat(61), "Monday");
    fireEvent.click(addButton());
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/60/);
    expect(api.createHabit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(addButton().disabled).toBe(false);
  });

  it("sends nothing for a whitespace-only name", () => {
    const api = renderAddHabit();
    fillIn("   ", "Monday");
    expect(addButton().disabled).toBe(true);
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    expect(api.createHabit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends no second request once the Added dialog is showing", async () => {
    const api = renderAddHabit();
    fillIn("Gym", "Monday");
    fireEvent.click(addButton());
    await screen.findByRole("dialog", { name: "Added" });

    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    fireEvent.click(addButton());
    await act(async () => {});
    expect(api.createHabit).toHaveBeenCalledTimes(1);
  });
});
