import { beforeEach, describe, expect, it, vi } from "vitest";

const amplify = vi.hoisted(() => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchUserAttributes: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => amplify);

import { AuthFailure, authApi } from "./auth";
import type { AuthErrorCode } from "./auth";

function amplifyError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("authApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("signUp sends the trimmed email as username and as the email attribute", async () => {
    amplify.signUp.mockResolvedValue({});
    await authApi.signUp("  a@x.com ", "Passw0rd!");
    expect(amplify.signUp).toHaveBeenCalledWith({
      username: "a@x.com",
      password: "Passw0rd!",
      options: { userAttributes: { email: "a@x.com" } },
    });
  });

  it("confirmSignUp sends the trimmed email and the code", async () => {
    amplify.confirmSignUp.mockResolvedValue({});
    await authApi.confirmSignUp(" a@x.com ", "123456");
    expect(amplify.confirmSignUp).toHaveBeenCalledWith({
      username: "a@x.com",
      confirmationCode: "123456",
    });
  });

  it("signIn resolves when Amplify reports isSignedIn", async () => {
    amplify.signIn.mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    });
    await expect(authApi.signIn(" a@x.com ", "pw")).resolves.toBeUndefined();
    expect(amplify.signIn).toHaveBeenCalledWith({
      username: "a@x.com",
      password: "pw",
    });
  });

  it("signIn throws user-not-confirmed when Amplify returns the CONFIRM_SIGN_UP next step", async () => {
    amplify.signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: "CONFIRM_SIGN_UP" },
    });
    await expect(authApi.signIn("a@x.com", "pw")).rejects.toMatchObject({
      code: "user-not-confirmed",
    });
  });

  it.each<[string, AuthErrorCode]>([
    ["UsernameExistsException", "user-exists"],
    ["NotAuthorizedException", "invalid-credentials"],
    ["UserNotFoundException", "invalid-credentials"],
    ["UserNotConfirmedException", "user-not-confirmed"],
    ["CodeMismatchException", "invalid-code"],
    ["ExpiredCodeException", "expired-code"],
    ["InvalidPasswordException", "invalid-password"],
    ["SomethingElseException", "unknown"],
  ])("maps Amplify error names to codes: %s -> %s", async (name, code) => {
    amplify.signIn.mockRejectedValue(amplifyError(name));
    const result = authApi.signIn("a@x.com", "pw");
    await expect(result).rejects.toBeInstanceOf(AuthFailure);
    await expect(result).rejects.toMatchObject({ code });
  });

  it("getCurrentUser returns the email attribute when signed in", async () => {
    amplify.getCurrentUser.mockResolvedValue({ userId: "u1" });
    amplify.fetchUserAttributes.mockResolvedValue({ email: "a@x.com" });
    await expect(authApi.getCurrentUser()).resolves.toBe("a@x.com");
  });

  it("getCurrentUser returns null when Amplify throws", async () => {
    amplify.getCurrentUser.mockRejectedValue(amplifyError("UserUnAuthenticatedException"));
    await expect(authApi.getCurrentUser()).resolves.toBeNull();
  });

  it("signOut calls Amplify signOut", async () => {
    amplify.signOut.mockResolvedValue(undefined);
    await authApi.signOut();
    expect(amplify.signOut).toHaveBeenCalledTimes(1);
  });
});
