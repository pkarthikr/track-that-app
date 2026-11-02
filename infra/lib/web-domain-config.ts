import type { WebCustomDomain } from "./web-stack";

const LEGACY_DOMAIN = "track-that.pkarthikr.in";

export function resolveWebCustomDomain(
  env: Record<string, string | undefined>,
): WebCustomDomain | undefined {
  const certificateArn = env.WEB_CERTIFICATE_ARN;
  if (certificateArn === undefined || certificateArn === "") {
    return undefined;
  }
  const webDomain = env.WEB_DOMAIN;
  const hasDomain = webDomain !== undefined && webDomain !== "";
  return {
    domainName: hasDomain ? webDomain : LEGACY_DOMAIN,
    certificateArn,
    includeWww: hasDomain,
  };
}
