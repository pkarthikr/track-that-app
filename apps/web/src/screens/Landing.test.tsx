import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Landing } from "./Landing";

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

describe("Landing", () => {
  it("renders the headline", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { level: 1, name: "Build habits you can see." }),
    ).toBeTruthy();
  });

  it("wraps the content in a main landmark", () => {
    renderLanding();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toBe(h1);
  });

  it("links Get started to register", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("has two Sign in links to sign-in", () => {
    renderLanding();
    const links = screen.getAllByRole("link", { name: "Sign in" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/sign-in");
  });

  it("shows a decorative sample habit card", () => {
    const { container } = renderLanding();
    const name = screen.getByText("Go to the gym");
    const card = name.closest(".habit-card") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).queryAllByRole("img")).toHaveLength(0);
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("sets the document title", () => {
    renderLanding();
    expect(document.title).toBe("Track That: Welcome");
  });
});
