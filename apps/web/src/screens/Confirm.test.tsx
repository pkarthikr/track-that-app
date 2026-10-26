import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../auth/auth";
import { AuthFailure } from "../auth/auth";
import { messageFor } from "../auth/messages";
import { Confirm } from "./Confirm";

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn(),
    confirmSignUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    ...overrides,
  };
}

function renderConfirm(auth: AuthApi) {
  const onConfirmed = vi.fn();
  const view = render(
    <MemoryRouter>
      <Confirm auth={auth} email="a@b.com" onConfirmed={onConfirmed} />
    </MemoryRouter>,
  );
  return { onConfirmed, container: view.container };
}

function codeInput() {
  return screen.getByLabelText("Confirmation code") as HTMLInputElement;
}

function submitButton() {
  return screen.getByRole("button", { name: "Verify and continue" }) as HTMLButtonElement;
}

function setup(auth: AuthApi) {
  const result = renderConfirm(auth);
  fireEvent.change(codeInput(), { target: { value: "123456" } });
  fireEvent.click(submitButton());
  return result;
}

describe("Confirm", () => {
  it("calls confirmSignUp with the email prop and entered code, then onConfirmed", async () => {
    const auth = fakeAuth();
    const { onConfirmed } = setup(auth);
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(auth.confirmSignUp).toHaveBeenCalledWith("a@b.com", "123456");
  });

  it("shows the heading and the email in a strong element", () => {
    renderConfirm(fakeAuth());
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
    const strong = screen.getByText("a@b.com");
    expect(strong.tagName).toBe("STRONG");
    expect(strong.parentElement?.textContent).toBe("We sent a 6-digit code to a@b.com.");
  });

  it("sets the page title", () => {
    renderConfirm(fakeAuth());
    expect(document.title).toBe("Track That: Confirm code");
  });

  it("disables submit until exactly 6 digits are entered", () => {
    renderConfirm(fakeAuth());
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(codeInput(), { target: { value: "12345" } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(codeInput(), { target: { value: "123456" } });
    expect(submitButton().disabled).toBe(false);
  });

  it("onChange strips non-digits and caps the value at 6 digits", () => {
    renderConfirm(fakeAuth());
    fireEvent.change(codeInput(), { target: { value: "12 ab34 56" } });
    expect(codeInput().value).toBe("123456");
    fireEvent.change(codeInput(), { target: { value: "12345678" } });
    expect(codeInput().value).toBe("123456");
  });

  it("accepts a pasted value with a space and enables submit", () => {
    renderConfirm(fakeAuth());
    fireEvent.change(codeInput(), { target: { value: "123 456" } });
    expect(codeInput().value).toBe("123456");
    expect(submitButton().disabled).toBe(false);
  });

  it("has no maxlength attribute, which would truncate pasted text before onChange", () => {
    renderConfirm(fakeAuth());
    expect(codeInput().hasAttribute("maxlength")).toBe(false);
  });

  it("does not call confirmSignUp when submitted while invalid", () => {
    const auth = fakeAuth();
    renderConfirm(auth);
    fireEvent.change(codeInput(), { target: { value: "123" } });
    fireEvent.submit(codeInput().closest("form")!);
    expect(auth.confirmSignUp).not.toHaveBeenCalled();
  });

  it("shows the invalid-code message as the alert tied to the code field", async () => {
    const auth = fakeAuth({
      confirmSignUp: vi.fn().mockRejectedValue(new AuthFailure("invalid-code")),
    });
    const { onConfirmed } = setup(auth);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("invalid-code"));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("shows the expired-code message on failure", async () => {
    const auth = fakeAuth({
      confirmSignUp: vi.fn().mockRejectedValue(new AuthFailure("expired-code")),
    });
    setup(auth);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("expired-code"));
  });

  it("links Back and Start over to /register, with no inline styles", () => {
    const { container } = renderConfirm(fakeAuth());
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Wrong email? Start over" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(container.querySelector("[style]")).toBeNull();
  });
});
