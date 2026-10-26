import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./Wordmark";

describe("Wordmark", () => {
  it("renders the text", () => {
    render(<Wordmark />);
    expect(screen.getByText("Track That")).toBeTruthy();
  });

  it("scales the mark with size", () => {
    const sm = render(<Wordmark size="sm" />);
    expect(sm.container.querySelector("svg")!.getAttribute("width")).toBe("23");
    sm.unmount();
    const lg = render(<Wordmark size="lg" />);
    expect(lg.container.querySelector("svg")!.getAttribute("width")).toBe("47");
  });

  it("adds the stacked class", () => {
    const { container } = render(<Wordmark variant="stacked" />);
    expect(container.firstElementChild!.classList.contains("wordmark--stacked")).toBe(true);
  });
});
