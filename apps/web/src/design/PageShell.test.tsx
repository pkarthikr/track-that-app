import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders children and header links", () => {
    render(
      <MemoryRouter>
        <PageShell>
          <p>Body content</p>
        </PageShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Body content")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Track That" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
  });

  it("shows a custom action link instead of Sign in", () => {
    render(
      <MemoryRouter>
        <PageShell action={{ label: "Create account", to: "/register" }}>
          <p>Body</p>
        </PageShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("shows only a Back link when `back` is set", () => {
    render(
      <MemoryRouter>
        <PageShell back={{ to: "/register" }}>
          <p>Body</p>
        </PageShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/register");
    expect(screen.queryByRole("link", { name: "Track That" })).toBeNull();
  });
});
