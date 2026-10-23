import type { AuthErrorCode } from "./auth";

const MESSAGES: Record<AuthErrorCode, string> = {
  "user-exists": "An account with this email already exists.",
  "invalid-credentials": "Incorrect email or password.",
  "user-not-confirmed": "Please confirm your email address first.",
  "invalid-code": "That code is not correct. Please try again.",
  "expired-code": "That code has expired. Please request a new one.",
  "invalid-password":
    "Password must be at least 8 characters with upper and lower case letters, a number, and a symbol.",
  unknown: "Something went wrong. Please try again.",
};

export function messageFor(code: AuthErrorCode): string {
  return MESSAGES[code];
}
