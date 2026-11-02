import { describe, expect, it } from "vitest";

import { resolveWebCustomDomain } from "./web-domain-config";

const certificateArn = "arn:aws:acm:us-east-1:123456789012:certificate/abc";

describe("resolveWebCustomDomain", () => {
  it("returns undefined without a certificate ARN", () => {
    expect(resolveWebCustomDomain({})).toBeUndefined();
    expect(resolveWebCustomDomain({ WEB_CERTIFICATE_ARN: "" })).toBeUndefined();
    expect(resolveWebCustomDomain({ WEB_DOMAIN: "track-that.com" })).toBeUndefined();
  });

  it("falls back to the legacy hostname without www", () => {
    expect(resolveWebCustomDomain({ WEB_CERTIFICATE_ARN: certificateArn })).toEqual({
      domainName: "track-that.pkarthikr.in",
      certificateArn,
      includeWww: false,
    });
  });

  it("uses WEB_DOMAIN and enables www", () => {
    expect(
      resolveWebCustomDomain({ WEB_CERTIFICATE_ARN: certificateArn, WEB_DOMAIN: "track-that.com" }),
    ).toEqual({ domainName: "track-that.com", certificateArn, includeWww: true });
  });

  it("treats an empty WEB_DOMAIN as unset", () => {
    expect(resolveWebCustomDomain({ WEB_CERTIFICATE_ARN: certificateArn, WEB_DOMAIN: "" })).toEqual({
      domainName: "track-that.pkarthikr.in",
      certificateArn,
      includeWww: false,
    });
  });
});
