import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HabitCard } from "./HabitCard";
import type { WeekDays } from "./WeekRow";

const days: WeekDays = ["open", "done", "open", "done", "open", "done", "done"];

describe("HabitCard", () => {
  it("shows the habit name and seven day images", () => {
    render(<HabitCard name="Read" color="teal" days={days} />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(7);
  });

  it("hides the week row from assistive tech when decorative", () => {
    const { container } = render(<HabitCard name="Read" color="teal" days={days} decorative />);
    expect(screen.getByText("Read")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(container.querySelector('[aria-hidden="true"] .week-row')).not.toBeNull();
  });

  it("keeps the ring aria-hidden and coloured via the habit class", () => {
    const { container } = render(<HabitCard name="Read" color="pink" days={days} />);
    const ring = container.querySelector(".habit-card__ring")!;
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.classList.contains("habit-color--pink")).toBe(true);
  });
});
