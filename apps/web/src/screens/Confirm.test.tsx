import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function setup(auth: AuthApi) {
  const onConfirmed = vi.fn();
  render(<Confirm auth={auth} email="a@b.com" onConfirmed={onConfirmed} />);
  fireEvent.change(screen.getByLabelText("Confirmation code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  return { onConfirmed };
}

describe("Confirm", () => {
  it("calls confirmSignUp with the email prop and entered code, then onConfirmed", async () => {
    const auth = fakeAuth();
    const { onConfirmed } = setup(auth);
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(auth.confirmSignUp).toHaveBeenCalledWith("a@b.com", "123456");
    expect(screen.getByRole("heading", { name: "Confirm your email" })).toBeTruthy();
  });

  it("shows the invalid-code message on failure", async () => {
    const auth = fakeAuth({
      confirmSignUp: vi.fn().mockRejectedValue(new AuthFailure("invalid-code")),
    });
    const { onConfirmed } = setup(auth);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("invalid-code"));
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
});
