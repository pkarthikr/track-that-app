import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("Home", () => {
  it("shows the Home heading in a main landmark", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Home" });
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBe(h1);
  });

  it("lists the placeholder habits, each with a week row", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Read 20 pages")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /\(today\)/ })).toHaveLength(6);
  });

  it("ticks a habit and marks today done", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const gym = screen.getByRole("button", { name: "Mark Go to the gym done" });
    expect(gym.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(gym);
    expect(gym.getAttribute("aria-pressed")).toBe("true");
    const card = gym.closest("li") as HTMLElement;
    expect(within(card).getByRole("img", { name: "Saturday (today): done" })).toBeTruthy();
    fireEvent.click(gym);
    expect(gym.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows rest days as rest days", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const stretch = screen.getByText("Stretch").closest("li") as HTMLElement;
    expect(within(stretch).getByRole("img", { name: "Saturday (today): rest day" })).toBeTruthy();
  });

  describe("with no habits", () => {
    it("shows the empty state instead of the list", () => {
      render(
        <MemoryRouter>
          <Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { level: 2, name: "No habits yet" })).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("keeps the title, the New habit button and the menu", () => {
      render(
        <MemoryRouter>
          <Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "New habit" })).toBeTruthy();
      openMenu();
      expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    });

    it("highlights the New habit button", () => {
      render(
        <MemoryRouter>
          <Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole("link", { name: "New habit" }).classList.contains("home__add--pulse"),
      ).toBe(true);
    });
  });

  it("does not show the empty state or highlight when there are habits", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("No habits yet")).toBeNull();
    expect(
      screen.getByRole("link", { name: "New habit" }).classList.contains("home__add--pulse"),
    ).toBe(false);
  });

  it("opens and closes the menu", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    openMenu();
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByText("a@b.com")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the menu on Escape", () => {
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    openMenu();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls onSignOut from the menu", () => {
    const onSignOut = vi.fn();
    render(
      <MemoryRouter>
        <Home email="a@b.com" onSignOut={onSignOut} />
      </MemoryRouter>,
    );
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
