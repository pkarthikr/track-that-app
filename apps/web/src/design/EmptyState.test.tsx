import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows the heading and the hint", () => {
    render(<EmptyState />);
    expect(screen.getByRole("heading", { level: 2, name: "No habits yet" })).toBeTruthy();
    expect(screen.getByText("Tap the + at the top right to add your first habit.")).toBeTruthy();
  });

  it("hides the arrow and sprout illustration from assistive tech", () => {
    const { container } = render(<EmptyState />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});
