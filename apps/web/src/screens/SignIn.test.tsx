import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../auth/auth";
import { AuthFailure } from "../auth/auth";
import { messageFor } from "../auth/messages";
import { SignIn } from "./SignIn";

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn(),
    confirmSignUp: vi.fn(),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    ...overrides,
  };
}

function setup(auth: AuthApi) {
  const handlers = {
    onSignedIn: vi.fn(),
    onNeedsConfirmation: vi.fn(),
    onShowRegister: vi.fn(),
  };
  render(<SignIn auth={auth} {...handlers} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Passw0rd!" } });
  return handlers;
}

function submitButton() {
  return screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
}

describe("SignIn", () => {
  it("calls signIn then onSignedIn(email)", async () => {
    const auth = fakeAuth();
    const { onSignedIn } = setup(auth);
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("a@b.com"));
    expect(auth.signIn).toHaveBeenCalledWith("a@b.com", "Passw0rd!");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("calls onNeedsConfirmation(email) when signIn rejects with user-not-confirmed", async () => {
    const auth = fakeAuth({
      signIn: vi.fn().mockRejectedValue(new AuthFailure("user-not-confirmed")),
    });
    const { onNeedsConfirmation, onSignedIn } = setup(auth);
    fireEvent.click(submitButton());
    await waitFor(() => expect(onNeedsConfirmation).toHaveBeenCalledWith("a@b.com"));
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("shows the invalid-credentials message on failure", async () => {
    const auth = fakeAuth({
      signIn: vi.fn().mockRejectedValue(new AuthFailure("invalid-credentials")),
    });
    const { onSignedIn } = setup(auth);
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("invalid-credentials"));
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("disables the submit button while pending", async () => {
    let resolve!: () => void;
    const signIn = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { onSignedIn } = setup(fakeAuth({ signIn }));
    const button = submitButton();
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    resolve();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it("links to register", () => {
    const { onShowRegister } = setup(fakeAuth());
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(onShowRegister).toHaveBeenCalledTimes(1);
  });
});
