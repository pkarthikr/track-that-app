import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DateString } from "@trackthat/shared";
import { Heatmap, heatLevel } from "./Heatmap";

const TODAY = "2026-10-30" as DateString;
const d = (value: string) => value as DateString;

function cells(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-date]")];
}

describe("heatLevel", () => {
  it.each([
    [0, 8, 0],
    [1, 8, 1],
    [2, 8, 1],
    [3, 8, 2],
    [4, 8, 2],
    [5, 8, 3],
    [6, 8, 3],
    [7, 8, 4],
    [8, 8, 4],
    [1, 1, 4],
    [1, 2, 2],
    [12, 8, 4],
  ])("count %i of goal %i is level %i", (count, goal, level) => {
    expect(heatLevel(count, goal)).toBe(level);
  });
});

describe("Heatmap", () => {
  it("shades each day by how much of the goal it reached", () => {
    const { container } = render(
      <Heatmap
        color="teal"
        counts={{ [d("2026-10-27")]: 1, [d("2026-10-28")]: 5, [d("2026-10-29")]: 8 }}
        goal={8}
        today={TODAY}
      />,
    );
    const level = (date: string) =>
      container.querySelector<HTMLElement>(`[data-date="${date}"]`)?.dataset.level;
    expect(level("2026-10-26")).toBeUndefined();
    expect(level("2026-10-27")).toBe("1");
    expect(level("2026-10-28")).toBe("3");
    expect(level("2026-10-29")).toBe("4");
    expect(screen.getByRole("img", { name: "14 completions in the last 365 days" })).toBeTruthy();
  });

  it("renders 365 cells from 2025-10-31 to 2026-10-30", () => {
    const { container } = render(<Heatmap color="green" counts={{}} goal={1} today={TODAY} />);
    const all = cells(container);
    expect(all).toHaveLength(365);
    expect(all[0]?.dataset.date).toBe("2025-10-31");
    expect(all[364]?.dataset.date).toBe("2026-10-30");
  });

  it("marks completed cells with the colour class", () => {
    const { container } = render(
      <Heatmap
        color="violet"
        counts={{ [d("2026-10-30")]: 1, [d("2026-10-01")]: 1 }}
        goal={1}
        today={TODAY}
      />,
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
        counts={{
          [d("2025-10-30")]: 1,
          [d("2026-10-31")]: 1,
          [d("2026-10-30")]: 1,
          [d("2025-10-31")]: 1,
        }}
        goal={1}
        today={TODAY}
      />,
    );
    expect(cells(container).filter((c) => c.dataset.done === "true")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "2 completions in the last 365 days" })).toBeTruthy();
  });

  it("uses the singular for one completion", () => {
    render(<Heatmap color="green" counts={{ [d("2026-10-30")]: 1 }} goal={1} today={TODAY} />);
    expect(screen.getByRole("img", { name: "1 completion in the last 365 days" })).toBeTruthy();
  });

  it("pads the first week so the first cell lands on its weekday", () => {
    // 2025-10-31 is a Friday: five leading spacers.
    const { container } = render(<Heatmap color="green" counts={{}} goal={1} today={TODAY} />);
    const grid = container.querySelector(".heatmap__grid")!;
    expect(grid.children).toHaveLength(5 + 365);
    expect(grid.children[5]?.getAttribute("data-date")).toBe("2025-10-31");
    expect(grid.children[4]?.hasAttribute("data-date")).toBe(false);
  });

  it("has no leading spacers when the first day is a Sunday", () => {
    // 2026-10-25 minus 364 days is Sunday 2025-10-26.
    const { container } = render(
      <Heatmap color="green" counts={{}} goal={1} today={d("2026-10-25")} />,
    );
    const grid = container.querySelector(".heatmap__grid")!;
    expect(grid.querySelectorAll(".heatmap__spacer")).toHaveLength(0);
    expect(grid.children[0]?.getAttribute("data-date")).toBe("2025-10-26");
    expect(cells(container)).toHaveLength(365);
  });

  it("is a focusable, labelled scroll region", () => {
    render(<Heatmap color="green" counts={{}} goal={1} today={TODAY} />);
    const region = screen.getByRole("region", { name: "Completion history, scrollable" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.contains(screen.getByRole("img"))).toBe(true);
  });

  describe("scroll position", () => {
    afterEach(() => {
      // @ts-expect-error remove the test-only instance override
      delete HTMLElement.prototype.scrollWidth;
    });

    it("starts scrolled to the newest weeks", () => {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get: () => 640,
      });
      render(<Heatmap color="green" counts={{}} goal={1} today={TODAY} />);
      const region = screen.getByRole("region", { name: "Completion history, scrollable" });
      expect(region.scrollLeft).toBe(640);
    });
  });
});
