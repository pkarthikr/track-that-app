import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { AuthApi } from "./auth/auth";
import { AuthFailure } from "./auth/auth";

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn().mockResolvedValue(undefined),
    confirmSignUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("App", () => {
  it("restores an existing session", async () => {
    const auth = fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") });
    render(<App auth={auth} />);
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("a@x.com")).toBeTruthy();
  });

  it("shows sign in when there is no session", async () => {
    render(<App auth={fakeAuth()} />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("register, confirm, sign in, sign out", async () => {
    const auth = fakeAuth();
    render(<App auth={auth} />);
    await screen.findByRole("heading", { name: "Sign in" });

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    await screen.findByRole("heading", { name: "Create your account" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByRole("heading", { name: "Confirm your email" });
    expect(auth.signUp).toHaveBeenCalledWith("a@x.com", "Passw0rd!");
    fireEvent.change(screen.getByLabelText("Confirmation code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("heading", { name: "Sign in" });
    expect(auth.confirmSignUp).toHaveBeenCalledWith("a@x.com", "123456");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Welcome" });
    expect(screen.getByText("a@x.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await screen.findByRole("heading", { name: "Sign in" });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("sends an unconfirmed user from sign in to confirm", async () => {
    const auth = fakeAuth({
      signIn: vi.fn().mockRejectedValue(new AuthFailure("user-not-confirmed")),
    });
    render(<App auth={auth} />);
    await screen.findByRole("heading", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Confirm your email" })).toBeTruthy();
    expect(screen.getByText("We sent a 6-digit code to a@x.com.")).toBeTruthy();
  });

  it("shows nothing but a loading state before the session check resolves", async () => {
    let resolve!: (email: string | null) => void;
    const auth = fakeAuth({
      getCurrentUser: vi.fn().mockReturnValue(
        new Promise<string | null>((r) => {
          resolve = r;
        }),
      ),
    });
    render(<App auth={auth} />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    resolve(null);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy());
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
