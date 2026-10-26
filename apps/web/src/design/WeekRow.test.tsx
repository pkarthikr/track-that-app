import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekRow, type WeekDays } from "./WeekRow";

const days: WeekDays = ["open", "done", "open", "done", "open", "done", "done"];

describe("WeekRow", () => {
  it("renders seven labelled images", () => {
    render(<WeekRow days={days} color="coral" />);
    const cells = screen.getAllByRole("img");
    expect(cells.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Sunday: not done",
      "Monday: done",
      "Tuesday: not done",
      "Wednesday: done",
      "Thursday: not done",
      "Friday: done",
      "Saturday (today): done",
    ]);
  });

  it("marks only the last cell as today", () => {
    render(<WeekRow days={days} color="coral" />);
    const cells = screen.getAllByRole("img");
    expect(cells.map((c) => c.classList.contains("week-row__cell--today"))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("labels today as not done when open", () => {
    render(
      <WeekRow days={["open", "open", "open", "open", "open", "open", "open"]} color="blue" />,
    );
    expect(screen.getByRole("img", { name: "Saturday (today): not done" })).toBeTruthy();
  });

  it("applies the colour class to done cells only", () => {
    render(<WeekRow days={days} color="violet" />);
    const cells = screen.getAllByRole("img");
    expect(cells.map((c) => c.classList.contains("habit-color--violet"))).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      true,
    ]);
    expect(cells[1]!.classList.contains("week-row__cell--done")).toBe(true);
    expect(cells[0]!.classList.contains("week-row__cell--open")).toBe(true);
  });

  it("shows the day letters", () => {
    render(<WeekRow days={days} color="green" />);
    expect(
      screen
        .getAllByRole("img")
        .map((c) => c.textContent)
        .join(""),
    ).toBe("SMTWTFS");
  });
});
