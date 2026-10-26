import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
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

function renderApp(auth: AuthApi, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App auth={auth} />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("restores an existing session", async () => {
    const auth = fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") });
    renderApp(auth);
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("a@x.com")).toBeTruthy();
  });

  it("shows the features page to a signed-out visitor", async () => {
    renderApp(fakeAuth(), "/features");
    expect(await screen.findByRole("heading", { level: 1, name: "Features" })).toBeTruthy();
  });

  it("shows the landing page when there is no session", async () => {
    renderApp(fakeAuth());
    expect(
      await screen.findByRole("heading", { level: 1, name: "Build habits you can see." }),
    ).toBeTruthy();
  });

  it("register, confirm, sign in, sign out", async () => {
    const auth = fakeAuth();
    renderApp(auth, "/sign-in");
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
    renderApp(auth, "/sign-in");
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
    renderApp(auth);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    resolve(null);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Build habits you can see." }),
      ).toBeTruthy(),
    );
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("sends /home signed out to sign in", async () => {
    renderApp(fakeAuth(), "/home");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("sends / signed in to the welcome screen", async () => {
    renderApp(fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") }), "/");
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
  });

  it("shows landing at / signed out and welcome at / signed in", async () => {
    const out = renderApp(fakeAuth(), "/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Build habits you can see." }),
    ).toBeTruthy();
    out.unmount();
    renderApp(fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") }), "/");
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
  });

  it("reaches the sign-in form from the landing page", async () => {
    renderApp(fakeAuth(), "/");
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getAllByRole("link", { name: "Sign in" })[0]!);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("sends /confirm without state to register", async () => {
    renderApp(fakeAuth(), "/confirm");
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeTruthy();
  });

  it("sends unknown paths signed out to the landing page", async () => {
    renderApp(fakeAuth(), "/nope");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Build habits you can see." }),
    ).toBeTruthy();
  });

  it("sends unknown paths signed in to the welcome screen", async () => {
    renderApp(fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") }), "/nope");
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
  });

  describe("signed in", () => {
    const signedIn = () => fakeAuth({ getCurrentUser: vi.fn().mockResolvedValue("a@x.com") });

    it("keeps a signed-in user off /sign-in", async () => {
      renderApp(signedIn(), "/sign-in");
      expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    });

    it("keeps a signed-in user off /register", async () => {
      renderApp(signedIn(), "/register");
      expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    });

    it("keeps a signed-in user off /confirm", async () => {
      render(
        <MemoryRouter initialEntries={[{ pathname: "/confirm", state: { email: "a@x.com" } }]}>
          <App auth={signedIn()} />
        </MemoryRouter>,
      );
      expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    });
  });

  it("does not return to the sign-in form on Back after signing in", async () => {
    function BackProbe() {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>probe-back</button>;
    }
    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <BackProbe />
        <App auth={fakeAuth()} />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Welcome" });
    fireEvent.click(screen.getByRole("button", { name: "probe-back" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull());
  });

  it("falls back to signed out when the session check rejects", async () => {
    renderApp(fakeAuth({ getCurrentUser: vi.fn().mockRejectedValue(new Error("boom")) }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Build habits you can see." }),
    ).toBeTruthy();
  });
});
