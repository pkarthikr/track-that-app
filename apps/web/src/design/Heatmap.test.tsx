import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DateString } from "@trackthat/shared";
import { Heatmap } from "./Heatmap";

const TODAY = "2026-10-30" as DateString;
const d = (value: string) => value as DateString;

function cells(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-date]")];
}

describe("Heatmap", () => {
  it("renders 365 cells from 2025-10-31 to 2026-10-30", () => {
    const { container } = render(<Heatmap color="green" done={[]} today={TODAY} />);
    const all = cells(container);
    expect(all).toHaveLength(365);
    expect(all[0]?.dataset.date).toBe("2025-10-31");
    expect(all[364]?.dataset.date).toBe("2026-10-30");
  });

  it("marks completed cells with the colour class", () => {
    const { container } = render(
      <Heatmap color="violet" done={[d("2026-10-30"), d("2026-10-01")]} today={TODAY} />,
    );
    const done = cells(container).filter((c) => c.dataset.done === "true");
    expect(done.map((c) => c.dataset.date)).toEqual(["2026-10-01", "2026-10-30"]);
    for (const cell of done) expect(cell.classList.contains("habit-color--violet")).toBe(true);
    expect(container.querySelectorAll(".habit-color--violet")).toHaveLength(2);
  });

  it("ignores completions outside the window and counts only the rest", () => {
    const { container } = render(
      <Heatmap
        color="green"
        done={[d("2025-10-30"), d("2026-10-31"), d("2026-10-30"), d("2025-10-31")]}
        today={TODAY}
      />,
    );
    expect(cells(container).filter((c) => c.dataset.done === "true")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "2 completions in the last 365 days" })).toBeTruthy();
  });

  it("uses the singular for one completion", () => {
    render(<Heatmap color="green" done={[d("2026-10-30")]} today={TODAY} />);
    expect(screen.getByRole("img", { name: "1 completion in the last 365 days" })).toBeTruthy();
  });

  it("pads the first week so the first cell lands on its weekday", () => {
    // 2025-10-31 is a Friday: five leading spacers.
    const { container } = render(<Heatmap color="green" done={[]} today={TODAY} />);
    const grid = container.querySelector(".heatmap__grid")!;
    expect(grid.children).toHaveLength(5 + 365);
    expect(grid.children[5]?.getAttribute("data-date")).toBe("2025-10-31");
    expect(grid.children[4]?.hasAttribute("data-date")).toBe(false);
  });
});
