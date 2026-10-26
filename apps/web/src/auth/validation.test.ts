import { describe, expect, it } from "vitest";
import { CODE_LENGTH, isPlausibleEmail, PASSWORD_MIN_LENGTH } from "./validation";

describe("validation", () => {
  it("accepts a plausible email, trimming whitespace", () => {
    expect(isPlausibleEmail(" a@b.com ")).toBe(true);
  });

  it("rejects implausible emails", () => {
    expect(isPlausibleEmail("a@b")).toBe(false);
    expect(isPlausibleEmail("")).toBe(false);
    expect(isPlausibleEmail("a b@c.com")).toBe(false);
  });

  it("exports length constants", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(CODE_LENGTH).toBe(6);
  });
});
