import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";

describe("readAuthConfig", () => {
  it("returns both values when present", () => {
    expect(
      readAuthConfig({
        VITE_USER_POOL_ID: "us-east-1_abc",
        VITE_USER_POOL_CLIENT_ID: "client123",
      }),
    ).toEqual({ userPoolId: "us-east-1_abc", userPoolClientId: "client123" });
  });

  it("throws naming VITE_USER_POOL_ID when it is missing", () => {
    expect(() => readAuthConfig({ VITE_USER_POOL_CLIENT_ID: "client123" })).toThrow(
      /VITE_USER_POOL_ID/,
    );
  });

  it("throws naming both variables when both are missing", () => {
    const message = (() => {
      try {
        readAuthConfig({});
      } catch (error) {
        return (error as Error).message;
      }
      return "";
    })();
    expect(message).toContain("VITE_USER_POOL_ID");
    expect(message).toContain("VITE_USER_POOL_CLIENT_ID");
  });

  it("treats an empty string as missing", () => {
    expect(() =>
      readAuthConfig({ VITE_USER_POOL_ID: "", VITE_USER_POOL_CLIENT_ID: "client123" }),
    ).toThrow(/VITE_USER_POOL_ID/);
  });
});
