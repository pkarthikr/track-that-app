# Web Hosting Design

Date: 2026-10-24
Status: Draft, awaiting review

## Goal

The web app is reachable at a CloudFront URL, deployed by the existing manual Deploy workflow. It is for the owner's own use: the URL is unlisted, nothing gates the site itself, and Cognito self sign-up stays on.

## Scope

In scope:

- A `WebStack` (`TrackThatWeb`) in the CDK app: a private S3 bucket behind a CloudFront distribution, with security headers, plus a `BucketDeployment` that publishes `apps/web/dist`.
- Changes to the Deploy workflow so it builds the web app and deploys `TrackThatWeb` with the other stacks.
- A web build step in CI before `cdk synth`.
- README documentation, including the new repo variables.

Out of scope (deliberately, YAGNI):

- A custom domain, certificate, or DNS.
- Gating access to the site (WAF, IP allowlist, basic auth) and turning off self sign-up.
- Dev/prod stages, SES email, resend-code, caching tuning.
- Any change to the OIDC stack, the deploy role, or its permissions.

## Decisions

| Decision              | Choice                                                            | Why                                                                                    |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Hosting               | Private S3 bucket + CloudFront, origin access control             | No public bucket; HTTPS by default                                                     |
| Publishing            | CDK `BucketDeployment` during `cdk deploy`                        | Runs under CloudFormation's own roles, so the OIDC deploy role gets no new permissions |
| Domain                | Default `*.cloudfront.net` address                                | Owner-only use; no certificate or DNS to manage                                        |
| Access control        | None beyond an unlisted URL; self sign-up stays on                | Owner's explicit choice                                                                |
| Pool ids in the build | Repo variables `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID` | The ids are baked in at build time; they are not secret                                |
| Workflow shape        | Extend the existing Deploy workflow                               | Keeps one manual, main-only deploy path                                                |

Consequence of open sign-ups: anyone who finds the URL could register and use up Cognito's default-sender limit of 50 emails a day. Accepted for an unlisted, single-owner site.

## Infrastructure (`infra`)

A new `WebStack` (separate from the other stacks) contains:

- An S3 bucket with all public access blocked, S3-managed encryption, enforced SSL, and no website hosting. Removal policy is the CDK default (retain), since the content is rebuildable and a leftover bucket is harmless.
- A CloudFront distribution with the bucket as its origin through origin access control, `index.html` as the default root object, HTTP redirected to HTTPS, compression on, the cheapest price class (`PRICE_CLASS_100`), and 403/404 responses answered with `/index.html` and status 200.
- A response headers policy attached to the default behavior with:
  - `Strict-Transport-Security` (at least one year, including subdomains);
  - `X-Content-Type-Options: nosniff`;
  - `X-Frame-Options: DENY`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cognito-idp.<stack region>.amazonaws.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
- A `BucketDeployment` that uploads the contents of `apps/web/dist` to the bucket, prunes files that no longer exist, and invalidates `/*` on the distribution.
- Stack outputs: `WebUrl` (`https://<distribution domain>`) and `BucketName`.

The directory published is a constructor option defaulting to `apps/web/dist`, so tests can point it at a small fixture folder and the stack does not require a real build to be unit-tested. The stack is environment-agnostic (no `env` prop); the CSP's Cognito host uses the stack's own region.

`bin/app.ts` instantiates it as `TrackThatWeb`. The current web app has no inline styles, no CSS file, and no inline scripts, so the CSP above should not need `unsafe-inline`. If a real browser check shows otherwise, widen only the specific directive.

## Build and deploy

- The Deploy workflow gains, before the `cdk deploy` step: a guard step that fails with a clear message if `vars.VITE_USER_POOL_ID` or `vars.VITE_USER_POOL_CLIENT_ID` is empty (deploying a build without them would publish a site that only shows a configuration error), then `pnpm --filter @trackthat/web build` with those two variables passed in `env`.
- Both new steps run before the AWS credentials step, so a missing variable or a failed build stops the run before any AWS call.
- The deploy command names `TrackThatApi TrackThatAuth TrackThatWeb`. Permissions, concurrency, the main-only guard, the timeout, and action versions are unchanged.
- CI (`ci.yml`) runs `pnpm --filter @trackthat/web build` before `cdk synth`, because `WebStack` reads `apps/web/dist` at synth time. This also makes CI fail on a broken build.
- The two repo variables are set once from the `TrackThatAuth` stack outputs (`UserPoolId`, `UserPoolClientId`) and must be updated if the user pool is ever recreated.

## Documentation

`README.md` is updated:

- Folder Layout and the Deploying section mention `TrackThatWeb` and that the Deploy workflow now builds and publishes the web app.
- The one-time setup gains the two new repo variables, with the `gh variable set` commands.
- The site URL is the `WebUrl` output of `TrackThatWeb`, shown in the workflow log after a deploy.
- A note that the site is unlisted but public, that self sign-up is open, and that the default email sender allows 50 emails a day.
- Next Steps drops web hosting.

## Testing

- CDK assertions on `WebStack` (`aws-cdk-lib/assertions`), built with a fixture asset folder:
  - the bucket blocks all public access, enforces SSL, and has no website configuration;
  - the distribution uses origin access control, redirects HTTP to HTTPS, has `index.html` as the default root object, and maps 403 and 404 to `/index.html` with 200;
  - the response headers policy contains the five headers, with the CSP's `connect-src` limited to `'self'` and the Cognito host and no `unsafe-inline` or `*` source;
  - there is no public bucket policy statement (no `Principal: "*"` allow);
  - the outputs `WebUrl` and `BucketName` exist.
- `cdk synth` in CI covers the new stack offline, after the web build step.
- The first real check is manual, after the one-time variable setup and a Deploy run: open `WebUrl`, confirm there are no CSP violations in the browser console, then register, confirm, sign in, reload, and sign out.

## Files

New: `infra/lib/web-stack.ts` and its test.
Changed: `infra/bin/app.ts`, `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `README.md`.
