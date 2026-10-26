import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoMark } from "./LogoMark";
import { palette } from "./palette";

function rects(container: HTMLElement) {
  return Array.from(container.querySelectorAll("rect"));
}

describe("LogoMark", () => {
  it("renders an aria-hidden svg sized by the size prop", () => {
    const { container } = render(<LogoMark size={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
  });

  it("defaults to 24", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("24");
  });

  it("fills four rects with green steps 1-4", () => {
    const { container } = render(<LogoMark />);
    expect(rects(container).map((r) => r.getAttribute("fill"))).toEqual([...palette.green]);
  });

  it("mono uses white with stepped opacity", () => {
    const { container } = render(<LogoMark mono />);
    const rs = rects(container);
    expect(rs.map((r) => r.getAttribute("fill"))).toEqual(["#fff", "#fff", "#fff", "#fff"]);
    expect(rs.map((r) => r.getAttribute("fill-opacity"))).toEqual(["0.38", "0.58", "0.8", "1"]);
  });
});
