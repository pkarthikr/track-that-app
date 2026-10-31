import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("labels rest days", () => {
    render(
      <WeekRow days={["rest", "done", "rest", "done", "rest", "done", "rest"]} color="teal" />,
    );
    expect(screen.getByRole("img", { name: "Sunday: rest day" })).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: "Saturday (today): rest day" })
        .classList.contains("week-row__cell--rest"),
    ).toBe(true);
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

  it("labels today by todayIndex and later days as upcoming", () => {
    render(
      <WeekRow
        days={["done", "open", "open", "open", "open", "open", "upcoming"]}
        todayIndex={5}
        color="blue"
      />,
    );
    expect(screen.getByRole("img", { name: "Friday (today): not done" })).toBeTruthy();
    const sat = screen.getByRole("img", { name: "Saturday: upcoming" });
    expect(sat.classList.contains("week-row__cell--upcoming")).toBe(true);
  });

  describe("with onToggleDay", () => {
    const toggleDays: WeekDays = ["rest", "done", "open", "open", "open", "open", "upcoming"];

    it("renders non-upcoming cells as buttons and calls back with the index", () => {
      const onToggleDay = vi.fn();
      render(<WeekRow days={toggleDays} todayIndex={5} color="teal" onToggleDay={onToggleDay} />);
      fireEvent.click(screen.getByRole("button", { name: "Tuesday: not done" }));
      expect(onToggleDay).toHaveBeenCalledWith(2);
      expect(screen.getAllByRole("button")).toHaveLength(6);
    });

    it("never renders upcoming cells as buttons", () => {
      render(<WeekRow days={toggleDays} todayIndex={5} color="teal" onToggleDay={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Saturday: upcoming" })).toBeNull();
      expect(screen.getByRole("img", { name: "Saturday: upcoming" })).toBeTruthy();
    });

    it("sets aria-pressed from the done state", () => {
      render(<WeekRow days={toggleDays} todayIndex={5} color="teal" onToggleDay={vi.fn()} />);
      expect(
        screen.getByRole("button", { name: "Monday: done" }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen.getByRole("button", { name: "Tuesday: not done" }).getAttribute("aria-pressed"),
      ).toBe("false");
    });
  });
});
