# Custom domain: move the app to track-that.com

## Goal

The web app is served from `https://track-that.com` over HTTPS. `www.track-that.com` redirects to the apex. The old hostname `track-that.pkarthikr.in` is retired. DNS for `track-that.com` lives on Cloudflare.

## Scope

In scope:

- `WebStack` support for a custom domain: CloudFront aliases, an imported ACM certificate, and a `www` -> apex redirect.
- Passing the domain and certificate ARN in through repo variables and the Deploy workflow.
- Tests for the new behavior.
- A README section with the domain config and the cutover runbook.

Out of scope:

- Cloudflare proxying (orange cloud). Cloudflare is DNS-only.
- Managing Cloudflare records or the ACM certificate from code.
- An API domain (the API stack is empty), and email on the domain.
- A redirect from `track-that.pkarthikr.in`. It is removed, not redirected.

## Decisions

| Topic            | Choice                                              | Why                                                                                              |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DNS host         | Cloudflare, DNS-only                                | Owner's choice. Browsers connect straight to CloudFront, so the existing headers and caching stay the only layer. |
| Certificate      | Requested once in ACM (us-east-1), ARN passed in    | CDK cannot write Cloudflare records, so an in-stack certificate would block the first deploy on a manual DNS step. |
| Old domain       | Removed                                             | Owner's choice. Nothing in the repo refers to it, so removal is deleting its DNS record.          |
| `www`            | 301 to the apex through a CloudFront Function       | One canonical URL. Path and query are preserved.                                                  |
| Unset config     | Behaves exactly as today (cloudfront.net only)      | CI synth and existing tests keep working with no domain configured.                               |

## Changes

### `infra/lib/web-stack.ts`

`WebStackProps` gains optional `domainName` and `certificateArn`.

- Both unset: no aliases, no custom certificate (today's behavior).
- Both set: the distribution gets `domainNames` of `[domainName, "www." + domainName]`, a `certificate` imported with `Certificate.fromCertificateArn`, `minimumProtocolVersion` TLS 1.2 (2021 policy), and SNI. A `cloudfront.Function` is attached to the default behavior as a viewer-request handler. If the `Host` header starts with `www.`, it returns a 301 to `https://<domainName><uri><querystring>`. Otherwise it passes the request through.
- Exactly one set: the constructor throws an error naming both props.
- `certificateArn` must be an ACM ARN in `us-east-1`. The constructor throws if it is not (a CloudFront requirement that otherwise fails late, at deploy).

Outputs: `WebUrl` is `https://<domainName>` when configured, else the cloudfront.net URL. A new `DistributionDomain` output holds `distributionDomainName` (the CNAME target for Cloudflare).

The CSP, HSTS (already `includeSubdomains`), other security headers, the 403/404 SPA fallback, and the bucket stay unchanged. The CSP uses `'self'` plus the Cognito endpoint, so it follows the new origin automatically.

### `infra/bin/app.ts`

Reads `WEB_DOMAIN` and `WEB_CERT_ARN` from the environment and passes them to `WebStack` (empty strings count as unset).

### `.github/workflows/deploy.yml`

The CDK deploy step passes `WEB_DOMAIN` and `WEB_CERT_ARN` from repo variables of the same names. The "Require web build variables" step also fails if exactly one of the two is set.

### Cognito

No change. The user pool client has `disableOAuth: true` and the app signs in with email and password directly, so there are no callback or logout URLs to update.

### Tests (`infra/lib/web-stack.test.ts`)

- Unset: the distribution has no `Aliases` and no custom `ViewerCertificate` (the existing assertions, kept as the unset case).
- Configured: `Aliases` hold both names, `ViewerCertificate` uses the given ARN with `SNI` and a TLS 1.2 minimum, and the default behavior has a viewer-request function association.
- The function code contains the 301 and the apex target.
- Half-configured props throw; a non-us-east-1 ARN throws.
- Outputs: `WebUrl` and `DistributionDomain` as described.

## Cutover runbook (documented in the README)

Every step that touches a real resource needs the owner's go-ahead for that exact step.

1. Owner points the registrar's nameservers at Cloudflare.
2. Request one ACM certificate in us-east-1 for `track-that.com` and `www.track-that.com`. Add its validation CNAME in Cloudflare (DNS-only). Wait for status `ISSUED`.
3. Set repo variables `WEB_DOMAIN=track-that.com` and `WEB_CERT_ARN=<arn>`.
4. Run the Deploy workflow (`gh workflow run deploy.yml --ref main`).
5. Read the `DistributionDomain` output. In Cloudflare add DNS-only CNAMEs for `track-that.com` (flattened at the apex) and `www`, both pointing at it.
6. Verify in a browser: the apex loads, `www` redirects with path preserved, sign-in works, a hard refresh on a deep link works.
7. Delete the `track-that.pkarthikr.in` DNS record.

Keep the certificate's validation CNAME in Cloudflare permanently; ACM uses it to renew.

## Risks and unverified items

- The redirect function, aliases and certificate wiring are covered by synth tests only. They are proven only by a real deploy, and browser behavior cannot be checked from this environment.
- The CloudFront alias is rejected if the certificate does not cover both names, or is not yet `ISSUED`, at deploy time. Step 2 must finish first.
- Changing aliases and the certificate updates the distribution in place and takes a few minutes to propagate; the cloudfront.net URL keeps working throughout.
- The old `track-that.pkarthikr.in` record is not in this repo, so its current target is unverified. The runbook only asks the owner to delete it.
