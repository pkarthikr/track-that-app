import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormCard } from "./FormCard";

describe("FormCard", () => {
  it("renders the title as an h1", () => {
    render(
      <FormCard title="Sign in" onSubmit={() => {}}>
        <span>child</span>
      </FormCard>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
  });

  it("omits the heading when no title is given", () => {
    render(
      <FormCard onSubmit={() => {}}>
        <span>child</span>
      </FormCard>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("fires onSubmit on submit", () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { container } = render(
      <FormCard title="T" onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </FormCard>,
    );
    fireEvent.submit(container.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders error as an alert", () => {
    render(
      <FormCard title="T" onSubmit={() => {}} error="Nope">
        <span>child</span>
      </FormCard>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Nope");
  });

  it("renders no alert without error and no style attributes", () => {
    const { container } = render(
      <FormCard title="T" onSubmit={() => {}}>
        <span>child</span>
      </FormCard>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });
});
