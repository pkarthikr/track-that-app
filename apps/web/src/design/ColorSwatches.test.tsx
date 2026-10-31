import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColorSwatches } from "./ColorSwatches";

describe("ColorSwatches", () => {
  it("renders seven named swatches in palette order", () => {
    render(<ColorSwatches />);
    const names = screen.getAllByRole("img").map((el) => el.getAttribute("aria-label"));
    expect(names).toEqual(["Green", "Teal", "Blue", "Violet", "Pink", "Coral", "Orange"]);
  });
});
