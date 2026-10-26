import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../auth/auth";
import { AuthFailure } from "../auth/auth";
import { messageFor } from "../auth/messages";
import { Register } from "./Register";

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    signUp: vi.fn().mockResolvedValue(undefined),
    confirmSignUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    ...overrides,
  };
}

function setup(auth: AuthApi) {
  const onRegistered = vi.fn();
  render(
    <MemoryRouter>
      <Register auth={auth} onRegistered={onRegistered} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
    target: { value: "Passw0rd!" },
  });
  return { onRegistered };
}

function submitButton() {
  return screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement;
}

describe("Register", () => {
  it("calls signUp with the entered email and password, then onRegistered(email)", async () => {
    const auth = fakeAuth();
    const { onRegistered } = setup(auth);
    fireEvent.click(submitButton());
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith("a@b.com"));
    expect(auth.signUp).toHaveBeenCalledWith("a@b.com", "Passw0rd!");
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
  });

  it("shows the user-exists message and stays put on failure", async () => {
    const auth = fakeAuth({
      signUp: vi.fn().mockRejectedValue(new AuthFailure("user-exists")),
    });
    const { onRegistered } = setup(auth);
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("user-exists"));
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("shows the password requirements on invalid-password", async () => {
    const auth = fakeAuth({
      signUp: vi.fn().mockRejectedValue(new AuthFailure("invalid-password")),
    });
    setup(auth);
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("8 characters");
  });

  it("shows the unknown message for non-AuthFailure errors", async () => {
    const auth = fakeAuth({ signUp: vi.fn().mockRejectedValue(new Error("boom")) });
    setup(auth);
    fireEvent.click(submitButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messageFor("unknown"));
  });

  it("disables the submit button while the request is pending and sends one request", async () => {
    let resolve!: () => void;
    const signUp = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { onRegistered } = setup(fakeAuth({ signUp }));
    const button = submitButton();
    const form = button.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    resolve();
    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
  });

  it("links to sign in from the header and below the card", () => {
    setup(fakeAuth());
    const links = screen.getAllByRole("link", { name: "Sign in" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/sign-in");
  });

  it("sets the page title and shows the password hint", () => {
    setup(fakeAuth());
    expect(document.title).toBe("Track That: Create account");
    expect(screen.getByText("At least 8 characters.")).toBeTruthy();
  });

  it("disables submit until email is plausible and password has 8 characters", () => {
    render(
      <MemoryRouter>
        <Register auth={fakeAuth()} onRegistered={vi.fn()} />
      </MemoryRouter>,
    );
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password", { selector: "input" });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(email, { target: { value: " a@b.com " } });
    fireEvent.change(password, { target: { value: "1234567" } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(password, { target: { value: "12345678" } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(email, { target: { value: "nope" } });
    expect(submitButton().disabled).toBe(true);
  });

  it("does not call signUp when submitted while invalid", () => {
    const auth = fakeAuth();
    render(
      <MemoryRouter>
        <Register auth={auth} onRegistered={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.submit(submitButton().closest("form")!);
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
