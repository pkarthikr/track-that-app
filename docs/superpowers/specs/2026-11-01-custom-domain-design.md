# Custom domain: move the app to track-that.com

## Goal

The web app is served from `https://track-that.com` over HTTPS. `www.track-that.com` redirects to the apex. The old hostname `track-that.pkarthikr.in` is retired. DNS for `track-that.com` lives on Cloudflare (DNS-only).

## Starting state (verified 2026-11-01)

This is an increment on `e3704ef feat(infra): optional custom domain for the web distribution`, already on `main` and deployed:

- `WebStack` has an optional `customDomain: { domainName, certificateArn }` prop. It sets one alias and imports the certificate (`Certificate.fromCertificateArn`, SNI). `bin/app.ts` hardcodes `domainName: "track-that.pkarthikr.in"` and reads the ARN from the `WEB_CERTIFICATE_ARN` env var; `deploy.yml` passes it from the repo variable of the same name.
- Deployed: stack `TrackThatWeb` (`UPDATE_COMPLETE`), distribution `ENQEH76X50MMO` (`d3aozdjtqh8agx.cloudfront.net`) with alias `track-that.pkarthikr.in`, using ACM certificate `976e71cb-59ab-44e9-96e0-07cf14d4506b`, which is `ISSUED` and covers only that hostname.
- Output `DistributionDomainName` already exists and stays. `WebUrl` is the cloudfront.net URL.
- Cognito has OAuth disabled (no callback or logout URLs). API CORS is `allowOrigins: ["*"]`. Neither needs a change.

## Scope

In scope:

- Make the custom domain's name configurable (`WEB_DOMAIN`) instead of hardcoded.
- Add the `www.<domain>` alias and a `www` -> apex 301 redirect.
- Validate the domain config at synth time.
- README section with the domain config and the cutover runbook.

Out of scope:

- Cloudflare proxying (orange cloud), and managing Cloudflare records or the ACM certificate from code.
- A redirect from `track-that.pkarthikr.in` (it is removed, not redirected).
- Email on the domain, and any API domain.

## Decisions

| Topic           | Choice                                                      | Why                                                                                                         |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| DNS host        | Cloudflare, DNS-only                                        | Owner's choice. Browsers connect straight to CloudFront.                                                    |
| Certificate     | Requested once in ACM (us-east-1); ARN in `WEB_CERTIFICATE_ARN` | Already the merged approach; CDK cannot write Cloudflare records.                                           |
| Domain name     | New repo variable `WEB_DOMAIN`; unset keeps `track-that.pkarthikr.in` | Existing deploys keep working unchanged until the owner flips the variables at cutover.                      |
| `www`           | Alias and 301 to the apex, opt-in via `includeWww`          | One canonical URL. Off for the legacy hostname, whose certificate has no `www` name.                        |
| Old domain      | Removed by the swap deploy, then its DNS record deleted     | Owner's choice. One deploy swaps alias and certificate in place.                                            |

## Changes

### `infra/lib/web-stack.ts`

`WebCustomDomain` keeps `domainName` and `certificateArn`. Behavior when `customDomain` is set:

- Validation (throws at construct time): `domainName` must be a lowercase hostname (no trailing dot, no leading `www.`); `certificateArn` must be an ACM ARN whose region is `us-east-1`.
- The new optional field `customDomain.includeWww` (boolean) controls `www`. When it is not `true`: one alias and no function, as today. The legacy certificate covers only `track-that.pkarthikr.in`, so the legacy hostname must not get a `www` alias.
- When `includeWww` is `true`, aliases are `[domainName, "www." + domainName]` and a viewer-request CloudFront Function on the default behavior 301s a request whose host is `www.<domainName>` to `https://<domainName><uri><querystring>`; all other hosts pass through. The certificate must cover both names.
- Either way the distribution sets `minimumProtocolVersion` TLS 1.2 (2021 policy).

`WebUrl` is `https://<domainName>` when `customDomain` is set, otherwise the cloudfront.net URL. `DistributionDomainName` is unchanged. CSP, HSTS, headers, bucket, and the SPA fallback are unchanged.

### `infra/bin/app.ts` and `.github/workflows/deploy.yml`

- `bin/app.ts`: `domainName` comes from `WEB_DOMAIN` (empty counts as unset, falling back to `track-that.pkarthikr.in`); `includeWww` is true exactly when `WEB_DOMAIN` is set. The certificate ARN logic is unchanged.
- `deploy.yml`: the CDK deploy step also passes `WEB_DOMAIN` from `vars.WEB_DOMAIN`.

### Tests (`infra/lib/web-stack.test.ts`)

Keep the existing custom-domain tests. Add: `includeWww` aliases, the viewer-request function and its redirect behavior (path and query kept, apex and look-alike hosts untouched), `WebUrl` on the domain, and the validation errors. Add a small `readWebDomainConfig` unit for the env parsing.

## Cutover runbook (documented in the README)

Every step that touches a real resource needs the owner's go-ahead for that exact step.

1. Owner points the registrar's nameservers at Cloudflare.
2. Request one ACM certificate in us-east-1 for `track-that.com` and `www.track-that.com`. Add its validation CNAME in Cloudflare (DNS-only). Wait for `ISSUED`. The existing certificate keeps serving until step 4.
3. Set repo variables: `WEB_DOMAIN=track-that.com`, and overwrite `WEB_CERTIFICATE_ARN` with the new ARN.
4. Run the Deploy workflow (`gh workflow run deploy.yml --ref main`). This swaps the alias and certificate in place. From here `track-that.pkarthikr.in` no longer serves the app.
5. In Cloudflare add DNS-only CNAMEs for `track-that.com` (apex, flattened) and `www`, both pointing at the `DistributionDomainName` output (`d3aozdjtqh8agx.cloudfront.net` unless the distribution is replaced).
6. Verify in a browser: the apex loads, `www` redirects with the path kept, sign-in works, a hard refresh on a deep link works.
7. Delete the `track-that.pkarthikr.in` DNS record. After step 4 the old certificate is unused and can be deleted.

Keep the new certificate's validation CNAME in Cloudflare permanently; ACM uses it to renew.

## Risks and unverified items

- The redirect function, aliases, and certificate wiring are covered by synth tests only; a real deploy proves them. Browser behavior cannot be checked from this environment.
- Step 4 is not zero-downtime for the old hostname by design. Between step 4 and step 5 the new domain has no DNS record yet, so the app is reachable only on the cloudfront.net URL. Do step 5 straight after step 4, or add the Cloudflare records before step 4 (they resolve to CloudFront but are rejected until the alias exists).
- Deploying with the new certificate before it is `ISSUED`, or with a certificate that does not cover both names, fails the stack update.
- Custom domain validation uses the same ARN-region rule as CloudFront: the certificate must be in `us-east-1`.
