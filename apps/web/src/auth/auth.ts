import {
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";

export type AuthErrorCode =
  | "user-exists"
  | "invalid-credentials"
  | "user-not-confirmed"
  | "invalid-code"
  | "expired-code"
  | "invalid-password"
  | "unknown";

export class AuthFailure extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "AuthFailure";
    this.code = code;
  }
}

export interface AuthApi {
  signUp(email: string, password: string): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Resolves to the signed-in user's email, or null when signed out. */
  getCurrentUser(): Promise<string | null>;
}

const CODE_BY_ERROR_NAME: Record<string, AuthErrorCode> = {
  UsernameExistsException: "user-exists",
  // Both map to the same code so sign-in never reveals whether an account exists.
  NotAuthorizedException: "invalid-credentials",
  UserNotFoundException: "invalid-credentials",
  UserNotConfirmedException: "user-not-confirmed",
  CodeMismatchException: "invalid-code",
  ExpiredCodeException: "expired-code",
  InvalidPasswordException: "invalid-password",
};

function toAuthFailure(error: unknown): AuthFailure {
  if (error instanceof AuthFailure) return error;
  const name = error instanceof Error ? error.name : undefined;
  const code = (name && CODE_BY_ERROR_NAME[name]) || "unknown";
  return new AuthFailure(code, { cause: error });
}

async function wrap<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toAuthFailure(error);
  }
}

export const authApi: AuthApi = {
  async signUp(email, password) {
    const username = email.trim();
    await wrap(() =>
      signUp({
        username,
        password,
        options: { userAttributes: { email: username } },
      }),
    );
  },

  async confirmSignUp(email, code) {
    await wrap(() => confirmSignUp({ username: email.trim(), confirmationCode: code.trim() }));
  },

  async signIn(email, password) {
    const result = await wrap(() => signIn({ username: email.trim(), password }));
    if (result.isSignedIn) return;
    if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
      throw new AuthFailure("user-not-confirmed");
    }
    throw new AuthFailure("unknown");
  },

  async signOut() {
    await wrap(() => signOut());
  },

  async getCurrentUser() {
    try {
      await getCurrentUser();
      const attributes = await fetchUserAttributes();
      return attributes.email ?? null;
    } catch {
      return null;
    }
  },
};
