import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignedIn } from "./SignedIn";

describe("SignedIn", () => {
  it("shows the email", () => {
    render(<SignedIn email="a@b.com" onSignOut={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("a@b.com")).toBeTruthy();
  });

  it("calls onSignOut when Sign out is clicked", () => {
    const onSignOut = vi.fn();
    render(<SignedIn email="a@b.com" onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
