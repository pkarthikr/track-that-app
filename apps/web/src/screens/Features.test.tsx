import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { Features } from "./Features";

function renderFeatures() {
  return render(
    <MemoryRouter>
      <Features />
    </MemoryRouter>,
  );
}

describe("Features", () => {
  beforeEach(() => {
    document.title = "";
  });

  it("renders the headings", () => {
    renderFeatures();
    expect(screen.getByRole("heading", { level: 1, name: "Features" })).toBeTruthy();
    for (const name of [
      "Three steps, nothing else.",
      "Your color, your habit.",
      "Start with one habit.",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
  });

  it("wraps the content in a main landmark", () => {
    renderFeatures();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBe(h1);
  });

  it("lists the three steps", () => {
    renderFeatures();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    ["Add a habit.", "Check in.", "Watch it fill in."].forEach((lead, i) => {
      expect(within(items[i]!).getByText(lead)).toBeTruthy();
    });
  });

  it("shows seven colour swatches and no coming-soon text", () => {
    renderFeatures();
    for (const name of ["Green", "Teal", "Blue", "Violet", "Pink", "Coral", "Orange"]) {
      expect(screen.getByRole("img", { name })).toBeTruthy();
    }
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("links Get started to register and the header to home", () => {
    renderFeatures();
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: "Track That" }).getAttribute("href")).toBe("/");
  });

  it("has decorative sample cards and no inline styles", () => {
    const { container } = renderFeatures();
    for (const name of ["Read 20 pages", "Water the plants"]) {
      const card = screen.getByText(name).closest(".habit-card") as HTMLElement;
      expect(card).toBeTruthy();
      expect(within(card).queryAllByRole("img")).toHaveLength(0);
    }
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("sets the document title", () => {
    renderFeatures();
    expect(document.title).toBe("Track That: Features");
  });
});
