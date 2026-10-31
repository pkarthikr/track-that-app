import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AddHabit } from "./AddHabit";

const SATURDAY = 6;

function renderAddHabit(today = SATURDAY) {
  return render(
    <MemoryRouter>
      <AddHabit today={today} />
    </MemoryRouter>,
  );
}

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

  it("confirms the habit and says it is due today", () => {
    renderAddHabit();
    fillIn("Go for a run", "Saturday");
    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
    const dialog = screen.getByRole("dialog", { name: "Added" });
    expect(within(dialog).getByText("Go for a run")).toBeTruthy();
    expect(within(dialog).getByText("Due today")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe(
      "/home",
    );
  });

  it("names the next due day when today is not one", () => {
    renderAddHabit();
    fillIn("Stretch", "Tuesday", "Thursday");
    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
    expect(screen.getByText("Next: Tue")).toBeTruthy();
  });

  it("does not show the confirmation before the form is submitted", () => {
    renderAddHabit();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
