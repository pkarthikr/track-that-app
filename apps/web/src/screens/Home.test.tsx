import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
}

describe("Home", () => {
  it("shows the Home heading in a main landmark", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Home" });
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBe(h1);
  });

  it("lists the placeholder habits, each with a week row", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Read 20 pages")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /\(today\)/ })).toHaveLength(6);
  });

  it("ticks a habit and marks today done", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
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
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    const stretch = screen.getByText("Stretch").closest("li") as HTMLElement;
    expect(within(stretch).getByRole("img", { name: "Saturday (today): rest day" })).toBeTruthy();
  });

  describe("with no habits", () => {
    it("shows the empty state instead of the list", () => {
      render(<Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />);
      expect(screen.getByRole("heading", { level: 2, name: "No habits yet" })).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("keeps the title, the New habit button and the menu", () => {
      render(<Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />);
      expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "New habit" })).toBeTruthy();
      openMenu();
      expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    });

    it("highlights the New habit button", () => {
      render(<Home email="a@b.com" habits={[]} onSignOut={vi.fn()} />);
      expect(
        screen.getByRole("button", { name: "New habit" }).classList.contains("home__add--pulse"),
      ).toBe(true);
    });
  });

  it("does not show the empty state or highlight when there are habits", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    expect(screen.queryByText("No habits yet")).toBeNull();
    expect(
      screen.getByRole("button", { name: "New habit" }).classList.contains("home__add--pulse"),
    ).toBe(false);
  });

  it("opens and closes the menu", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    openMenu();
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByText("a@b.com")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the menu on Escape", () => {
    render(<Home email="a@b.com" onSignOut={vi.fn()} />);
    openMenu();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("calls onSignOut from the menu", () => {
    const onSignOut = vi.fn();
    render(<Home email="a@b.com" onSignOut={onSignOut} />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
