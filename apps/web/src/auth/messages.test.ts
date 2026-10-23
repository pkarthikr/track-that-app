import { describe, expect, it } from "vitest";
import type { AuthErrorCode } from "./auth";
import { messageFor } from "./messages";

const codes: AuthErrorCode[] = [
  "user-exists",
  "invalid-credentials",
  "user-not-confirmed",
  "invalid-code",
  "expired-code",
  "invalid-password",
  "unknown",
];

describe("messageFor", () => {
  it.each(codes)("returns a non-empty message for %s", (code) => {
    expect(messageFor(code).length).toBeGreaterThan(0);
  });

  it("states the password policy for invalid-password", () => {
    expect(messageFor("invalid-password")).toContain("8 characters");
  });
});
