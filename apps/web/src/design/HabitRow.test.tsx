import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HabitRow } from "./HabitRow";
import type { WeekDays } from "./WeekRow";

const DAYS: WeekDays = ["rest", "done", "open", "open", "open", "open", "upcoming"];

function renderRow(props: Partial<Parameters<typeof HabitRow>[0]> = {}) {
  const onOpen = vi.fn();
  const onToggleDay = vi.fn();
  render(
    <ul>
      <HabitRow
        name="Read"
        color="green"
        active
        streak={0}
        days={DAYS}
        todayIndex={5}
        onOpen={onOpen}
        onToggleDay={onToggleDay}
        {...props}
      />
    </ul>,
  );
  return { onOpen, onToggleDay };
}

describe("HabitRow", () => {
  it("toggles today from the check button", () => {
    const { onToggleDay } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Mark Read done" }));
    expect(onToggleDay).toHaveBeenCalledWith(5);
  });

  it("disables the check button and ignores clicks while pending", () => {
    const { onToggleDay } = renderRow({ pending: true });
    const check = screen.getByRole("button", { name: "Mark Read done" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    fireEvent.click(check);
    expect(onToggleDay).not.toHaveBeenCalled();
  });

  it("opens the habit from its name", () => {
    const { onOpen } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the streak when it is above zero", () => {
    renderRow({ streak: 3 });
    expect(screen.getByText("Streak 3")).toBeTruthy();
  });

  it("shows no streak for zero", () => {
    renderRow({ streak: 0 });
    expect(screen.queryByText(/Streak/)).toBeNull();
  });

  it("reflects a done today on the check button", () => {
    renderRow({ days: ["rest", "done", "open", "open", "open", "done", "upcoming"] });
    expect(
      screen.getByRole("button", { name: "Mark Read done" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
