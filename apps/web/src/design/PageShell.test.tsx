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
});
