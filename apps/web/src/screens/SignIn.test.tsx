import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  };
  render(
    <MemoryRouter>
      <SignIn auth={auth} {...handlers} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
    target: { value: "Passw0rd!" },
  });
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

  it("links to register from below the card and the header", () => {
    setup(fakeAuth());
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: "Create account" }).getAttribute("href")).toBe(
      "/register",
    );
  });

  it("sets the page title", () => {
    setup(fakeAuth());
    expect(document.title).toBe("Track That: Sign in");
  });

  it("disables submit until email is plausible and password is non-empty", () => {
    render(
      <MemoryRouter>
        <SignIn auth={fakeAuth()} onSignedIn={vi.fn()} onNeedsConfirmation={vi.fn()} />
      </MemoryRouter>,
    );
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password", { selector: "input" });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(email, { target: { value: "a@b.com" } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(password, { target: { value: "x" } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(email, { target: { value: "nope" } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(email, { target: { value: " a@b.com " } });
    expect(submitButton().disabled).toBe(false);
  });

  it("does not call signIn when submitted while invalid", () => {
    const auth = fakeAuth();
    render(
      <MemoryRouter>
        <SignIn auth={auth} onSignedIn={vi.fn()} onNeedsConfirmation={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.submit(submitButton().closest("form")!);
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    setup(fakeAuth());
    const password = screen.getByLabelText("Password", { selector: "input" });
    expect(password.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
  });
});
