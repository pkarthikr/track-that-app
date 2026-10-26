import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("renders a password input", () => {
    render(<PasswordField label="Password" />);
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
  });

  it("toggles visibility and keeps the value", () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");
    expect(input.value).toBe("secret123");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.textContent).toBe("Hide");
    expect(hide.getAttribute("type")).toBe("button");
    fireEvent.click(hide);
    expect(input.getAttribute("type")).toBe("password");
    expect(input.value).toBe("secret123");
  });

  it("keeps the toggle outside the label", () => {
    render(<PasswordField label="Password" />);
    expect(screen.getByRole("button").closest("label")).toBeNull();
  });
});
