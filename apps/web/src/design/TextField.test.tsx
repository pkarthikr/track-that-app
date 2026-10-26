import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText("Email").tagName).toBe("INPUT");
  });

  it("references the hint via aria-describedby", () => {
    render(<TextField label="Email" hint="We never share it" />);
    const input = screen.getByLabelText("Email");
    const id = input.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)!.textContent).toBe("We never share it");
  });

  it("shows the error as an alert and marks the input invalid", () => {
    render(<TextField label="Email" hint="Hint" error="Bad email" />);
    const input = screen.getByLabelText("Email");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Bad email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain(alert.id);
    expect(ids).toHaveLength(2);
  });

  it("has no aria-invalid or describedby by default", () => {
    render(<TextField label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("applies the code variant class", () => {
    render(<TextField label="Code" variant="code" />);
    expect(screen.getByLabelText("Code").classList.contains("text-field__input--code")).toBe(true);
  });

  it("passes input attributes through", () => {
    render(<TextField label="Email" type="email" autoComplete="email" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
  });
});
