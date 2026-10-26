import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Button", () => {
  it("renders a link when given `to`", () => {
    renderInRouter(<Button to="/register">Get started</Button>);
    const link = screen.getByRole("link", { name: "Get started" });
    expect(link.getAttribute("href")!.endsWith("/register")).toBe(true);
  });

  it("renders a button of type button without `to`", () => {
    renderInRouter(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).getAttribute("type")).toBe("button");
  });

  it("applies the primary variant by default", () => {
    renderInRouter(<Button>Go</Button>);
    const el = screen.getByRole("button");
    expect(el.classList.contains("button")).toBe(true);
    expect(el.classList.contains("button--primary")).toBe(true);
  });

  it("applies the ghost variant", () => {
    renderInRouter(<Button variant="ghost">Go</Button>);
    expect(screen.getByRole("button").classList.contains("button--ghost")).toBe(true);
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    renderInRouter(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    renderInRouter(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const el = screen.getByRole("button") as HTMLButtonElement;
    expect(el.disabled).toBe(true);
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });
});
