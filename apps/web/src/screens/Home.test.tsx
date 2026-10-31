import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { HabitSummary } from "@trackthat/shared";
import { describe, expect, it, vi } from "vitest";
import type { HabitsApi } from "../habits/api";
import { Home } from "./Home";

// 2026-10-30 is a Friday; its week runs Sunday 2026-10-25 to Saturday 2026-10-31.
const TODAY = "2026-10-30";

function habit(overrides: Partial<HabitSummary> = {}): HabitSummary {
  return {
    id: "h1",
    name: "Read 20 pages",
    color: "green",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    createdAt: "2026-10-01T00:00:00.000Z",
    streak: 0,
    weekDone: [],
    ...overrides,
  };
}

function fakeApi(habits: HabitSummary[] = [habit()]): HabitsApi {
  return {
    listHabits: vi.fn().mockResolvedValue(habits),
    getHabit: vi.fn(),
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    logCompletion: vi.fn().mockResolvedValue(undefined),
    undoCompletion: vi.fn().mockResolvedValue(undefined),
  };
}

function renderHome(api: HabitsApi, props: Partial<Parameters<typeof Home>[0]> = {}) {
  const handlers = { onSignOut: vi.fn(), onNewHabit: vi.fn(), onOpenHabit: vi.fn() };
  render(<Home email="a@b.com" api={api} today={TODAY} {...handlers} {...props} />);
  return handlers;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const check = (name = "Read 20 pages") => screen.getByRole("button", { name: `Mark ${name} done` });
const cell = (label: string) => screen.getByRole("button", { name: label });

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("Home", () => {
  it("shows the Home heading in a main landmark", async () => {
    renderHome(fakeApi());
    const h1 = screen.getByRole("heading", { level: 1, name: "Home" });
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBe(h1);
    await screen.findByText("Read 20 pages");
  });

  it("shows a loading status, then a row per habit loaded for today", async () => {
    const api = fakeApi([habit(), habit({ id: "h2", name: "Stretch" })]);
    renderHome(api);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(await screen.findByText("Read 20 pages")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(api.listHabits).toHaveBeenCalledWith(TODAY);
  });

  it("shows weekdays not scheduled as rest days", async () => {
    renderHome(fakeApi([habit({ weekdays: [1, 2, 3, 4, 5] })]));
    await screen.findByText("Read 20 pages");
    expect(screen.getByRole("button", { name: "Sunday: rest day" })).toBeTruthy();
  });

  it("shows the streak", async () => {
    renderHome(fakeApi([habit({ streak: 4 })]));
    expect(await screen.findByText("Streak 4")).toBeTruthy();
  });

  describe("with no habits", () => {
    it("shows the empty state instead of the list", async () => {
      renderHome(fakeApi([]));
      expect(await screen.findByRole("heading", { level: 2, name: "No habits yet" })).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("keeps the title, the New habit button and the menu", async () => {
      renderHome(fakeApi([]));
      await screen.findByText("No habits yet");
      expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "New habit" })).toBeTruthy();
      openMenu();
      expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    });

    it("highlights the New habit button", async () => {
      renderHome(fakeApi([]));
      await screen.findByText("No habits yet");
      expect(
        screen.getByRole("button", { name: "New habit" }).classList.contains("home__add--pulse"),
      ).toBe(true);
    });
  });

  it("does not show the empty state or highlight when there are habits", async () => {
    renderHome(fakeApi());
    await screen.findByText("Read 20 pages");
    expect(screen.queryByText("No habits yet")).toBeNull();
    expect(
      screen.getByRole("button", { name: "New habit" }).classList.contains("home__add--pulse"),
    ).toBe(false);
  });

  describe("when loading fails", () => {
    it("shows an alert and recovers on Retry", async () => {
      const api = fakeApi();
      vi.mocked(api.listHabits).mockRejectedValueOnce(new Error("boom"));
      renderHome(api);
      expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Read 20 pages")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(api.listHabits).toHaveBeenCalledTimes(2);
    });

    it("handles a non-API error such as a bad response body", async () => {
      const api = fakeApi();
      vi.mocked(api.listHabits).mockRejectedValueOnce(new SyntaxError("Unexpected token"));
      renderHome(api);
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });
  });

  describe("ticking", () => {
    it("logs today, shows it done at once, then reloads", async () => {
      const api = fakeApi();
      const write = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(write.promise);
      renderHome(api);
      await screen.findByText("Read 20 pages");

      fireEvent.click(check());
      expect(api.logCompletion).toHaveBeenCalledWith("h1", TODAY);
      expect(check().getAttribute("aria-pressed")).toBe("true");
      expect(cell("Friday (today): done")).toBeTruthy();
      expect(api.listHabits).toHaveBeenCalledTimes(1);

      vi.mocked(api.listHabits).mockResolvedValueOnce([habit({ weekDone: [TODAY], streak: 1 })]);
      await act(async () => {
        write.resolve();
      });
      expect(await screen.findByText("Streak 1")).toBeTruthy();
      expect(api.listHabits).toHaveBeenCalledTimes(2);
      expect(api.listHabits).toHaveBeenLastCalledWith(TODAY);
    });

    it("calls undoCompletion for a done day", async () => {
      const api = fakeApi([habit({ weekDone: [TODAY] })]);
      renderHome(api);
      await screen.findByText("Read 20 pages");
      fireEvent.click(check());
      expect(api.undoCompletion).toHaveBeenCalledWith("h1", TODAY);
      expect(api.logCompletion).not.toHaveBeenCalled();
      await waitFor(() => expect(check()).toHaveProperty("disabled", false));
    });

    it("logs a past day from its cell", async () => {
      const api = fakeApi();
      renderHome(api);
      await screen.findByText("Read 20 pages");
      fireEvent.click(cell("Tuesday: not done"));
      expect(api.logCompletion).toHaveBeenCalledWith("h1", "2026-10-27");
      expect(cell("Tuesday: done")).toBeTruthy();
      await waitFor(() => expect(check()).toHaveProperty("disabled", false));
    });

    it("does nothing for upcoming cells", async () => {
      const api = fakeApi();
      renderHome(api);
      await screen.findByText("Read 20 pages");
      const saturday = screen.getByRole("img", { name: "Saturday: upcoming" });
      fireEvent.click(saturday);
      expect(api.logCompletion).not.toHaveBeenCalled();
      expect(api.undoCompletion).not.toHaveBeenCalled();
    });

    it("disables the check button while pending and sends one request for a second click", async () => {
      const api = fakeApi();
      const write = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(write.promise);
      renderHome(api);
      await screen.findByText("Read 20 pages");

      fireEvent.click(check());
      expect(check()).toHaveProperty("disabled", true);
      fireEvent.click(check());
      fireEvent.click(cell("Tuesday: not done"));
      expect(api.logCompletion).toHaveBeenCalledTimes(1);

      await act(async () => {
        write.resolve();
      });
      await waitFor(() => expect(check()).toHaveProperty("disabled", false));
    });

    it("rolls back a failed write and shows an alert", async () => {
      const api = fakeApi();
      const write = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(write.promise);
      renderHome(api);
      await screen.findByText("Read 20 pages");

      fireEvent.click(check());
      expect(check().getAttribute("aria-pressed")).toBe("true");
      await act(async () => {
        write.reject(new Error("nope"));
      });
      expect(check().getAttribute("aria-pressed")).toBe("false");
      expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save that. Try again.");
      expect(check()).toHaveProperty("disabled", false);
      // A failed write may still have been applied, so the list is refreshed.
      await waitFor(() => expect(api.listHabits).toHaveBeenCalledTimes(2));
    });

    it("resyncs after a failed write the server actually applied", async () => {
      const api = fakeApi();
      const write = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(write.promise);
      renderHome(api);
      await screen.findByText("Read 20 pages");

      vi.mocked(api.listHabits).mockResolvedValueOnce([habit({ weekDone: [TODAY], streak: 1 })]);
      fireEvent.click(check());
      await act(async () => {
        write.reject(new Error("timeout"));
      });

      expect((await screen.findByRole("alert")).textContent).toBe("Couldn't save that. Try again.");
      expect(await screen.findByText("Streak 1")).toBeTruthy();
      expect(check().getAttribute("aria-pressed")).toBe("true");
    });

    it("reloads after a later write fails so an earlier tick's streak still refreshes", async () => {
      const api = fakeApi([habit(), habit({ id: "h2", name: "Stretch" })]);
      renderHome(api);
      await screen.findByText("Stretch");

      let release!: (habits: HabitSummary[]) => void;
      vi.mocked(api.listHabits).mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      fireEvent.click(check());
      await waitFor(() => expect(api.listHabits).toHaveBeenCalledTimes(2));

      const second = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(second.promise);
      fireEvent.click(check("Stretch"));

      // Reload for the first tick returns while the second write is pending: dropped.
      await act(async () => {
        release([habit({ weekDone: [TODAY], streak: 1 }), habit({ id: "h2", name: "Stretch" })]);
      });
      expect(screen.queryByText("Streak 1")).toBeNull();

      vi.mocked(api.listHabits).mockResolvedValueOnce([
        habit({ weekDone: [TODAY], streak: 1 }),
        habit({ id: "h2", name: "Stretch" }),
      ]);
      await act(async () => {
        second.reject(new Error("nope"));
      });
      expect(await screen.findByText("Streak 1")).toBeTruthy();
      expect(api.listHabits).toHaveBeenCalledTimes(3);
      expect(check("Stretch").getAttribute("aria-pressed")).toBe("false");
    });

    it("ignores a stale reload that returns after a later write started", async () => {
      const api = fakeApi([habit(), habit({ id: "h2", name: "Stretch" })]);
      renderHome(api);
      await screen.findByText("Stretch");

      let release!: (habits: HabitSummary[]) => void;
      vi.mocked(api.listHabits).mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      fireEvent.click(check());
      await waitFor(() => expect(api.listHabits).toHaveBeenCalledTimes(2));

      const second = deferred();
      vi.mocked(api.logCompletion).mockReturnValueOnce(second.promise);
      fireEvent.click(check("Stretch"));
      expect(check("Stretch").getAttribute("aria-pressed")).toBe("true");

      // The earlier reload predates the second write, so it must not undo it.
      await act(async () => {
        release([habit({ weekDone: [TODAY] }), habit({ id: "h2", name: "Stretch" })]);
      });
      expect(check("Stretch").getAttribute("aria-pressed")).toBe("true");

      vi.mocked(api.listHabits).mockResolvedValueOnce([
        habit({ weekDone: [TODAY] }),
        habit({ id: "h2", name: "Stretch", weekDone: [TODAY] }),
      ]);
      await act(async () => {
        second.resolve();
      });
      await waitFor(() => expect(check("Stretch")).toHaveProperty("disabled", false));
      expect(check("Stretch").getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("calls onNewHabit from the + button", async () => {
    const { onNewHabit } = renderHome(fakeApi());
    await screen.findByText("Read 20 pages");
    fireEvent.click(screen.getByRole("button", { name: "New habit" }));
    expect(onNewHabit).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenHabit with the id from a habit name", async () => {
    const { onOpenHabit } = renderHome(fakeApi());
    fireEvent.click(await screen.findByRole("button", { name: "Read 20 pages" }));
    expect(onOpenHabit).toHaveBeenCalledWith("h1");
  });

  it("opens and closes the menu", async () => {
    renderHome(fakeApi());
    await screen.findByText("Read 20 pages");
    expect(screen.queryByRole("dialog")).toBeNull();
    openMenu();
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByText("a@b.com")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the menu on Escape", async () => {
    renderHome(fakeApi());
    await screen.findByText("Read 20 pages");
    openMenu();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls onSignOut from the menu", async () => {
    const { onSignOut } = renderHome(fakeApi());
    await screen.findByText("Read 20 pages");
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
