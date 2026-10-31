import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSwatches } from "./ColorSwatches";

describe("ColorSwatches", () => {
  it("renders seven named swatches in palette order", () => {
    render(<ColorSwatches />);
    const names = screen.getAllByRole("img").map((el) => el.getAttribute("aria-label"));
    expect(names).toEqual(["Green", "Teal", "Blue", "Violet", "Pink", "Coral", "Orange"]);
  });

  it("becomes a radiogroup when given onChange", () => {
    const onChange = vi.fn();
    render(<ColorSwatches value="teal" onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: "Teal" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Coral" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("radio", { name: "Coral" }));
    expect(onChange).toHaveBeenCalledWith("coral");
  });
});
