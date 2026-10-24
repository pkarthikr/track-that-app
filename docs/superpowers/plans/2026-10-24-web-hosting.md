# Web Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The web app is served from a CloudFront URL and published by the existing manual Deploy workflow, for the owner's own use.

**Architecture:** A new `WebStack` (`TrackThatWeb`) holds a private S3 bucket behind CloudFront (origin access control, security headers including a strict CSP), and a CDK `BucketDeployment` that publishes `apps/web/dist` during `cdk deploy`, so the OIDC deploy role needs no new permissions. The Deploy workflow builds the web app (with the Cognito ids from repo variables) before `cdk deploy`; CI builds it before `cdk synth`.

**Tech Stack:** AWS CDK (`aws-cdk-lib`: S3, CloudFront, CloudFront Origins, S3 Deployment), GitHub Actions, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-web-hosting-design.md`

## Global Constraints

- Stack id is `TrackThatWeb` (class `WebStack`, file `infra/lib/web-stack.ts`). Environment-agnostic: no `env` prop. Outputs are named `WebUrl` and `BucketName`.
- Bucket: all public access blocked, S3-managed encryption, SSL enforced, no website hosting, default removal policy (retain). CloudFront reads it through origin access control. No public bucket policy statement.
- Distribution: `index.html` as default root object, HTTP redirected to HTTPS, compression on, `PRICE_CLASS_100`, 403 and 404 answered with `/index.html` and status 200. No custom domain.
- Response headers policy on the default behavior: `Strict-Transport-Security` (max age at least 31536000, including subdomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and this exact `Content-Security-Policy` (with the stack's region where shown): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cognito-idp.<region>.amazonaws.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. No `unsafe-inline`, no `unsafe-eval`, no `*` source.
- `BucketDeployment` publishes the contents of `apps/web/dist` (the directory is a constructor option defaulting to that path), prunes, and invalidates `/*`.
- Pool ids reach the build only through repo variables `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID`. The Deploy workflow fails with a clear message if either is empty, before any AWS call.
- The Deploy workflow keeps: `workflow_dispatch` only, `id-token: write` + `contents: read`, concurrency group `deploy` with `cancel-in-progress: false`, the main-only guard as its first step, `timeout-minutes: 60`, the existing action versions, and verification before the credentials step. It deploys `TrackThatApi TrackThatAuth TrackThatWeb` (never `GithubOidcStack`).
- `infra/lib/github-oidc-stack.ts` and its test do not change; the OIDC role's permissions do not widen.
- Out of scope: custom domain, WAF or access gating, turning off self sign-up, dev/prod stages, SES, resend-code, caching tuning.
- Nothing in this plan may call AWS: there are no credentials on the build machine. `cdk synth` is offline and is the only CDK command to run. Never run `cdk deploy` or `cdk bootstrap`.
- Match existing style: double quotes, semicolons, `import type` / inline `type` imports (`verbatimModuleSyntax`), tests co-located as `*.test.ts`, explicit Vitest imports (globals off). Run `pnpm format` before each commit.
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- The bucket must never become publicly readable: public access fully blocked and no `Allow` statement for a wildcard principal in any bucket policy. Pinned in Task 1.
- The CSP must not silently weaken: the whole policy string is asserted exactly, including that no `unsafe-*` or bare `*` source appears. Pinned in Task 1.
- A deploy run without the pool-id variables must not publish a site that only shows a configuration error: the workflow fails before AWS credentials are requested. Pinned in Task 2 (guard step placement).
- CI must not break because `apps/web/dist` does not exist at synth time: the web build runs before `cdk synth`. Pinned in Task 1 (`ci.yml`).
- The deploy role's trust and permissions must not change as a side effect: the OIDC stack file and its tests are untouched and still pass. Pinned in Task 3 (verification step).

---

### Task 1: `WebStack` and CI build step

**Files:**

- Create: `infra/lib/web-stack.ts`
- Create: `infra/lib/web-stack.test.ts`
- Modify: `infra/bin/app.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: `export interface WebStackProps extends StackProps { readonly webAssetPath?: string }` and `export class WebStack extends Stack` (constructor `(scope: Construct, id: string, props?: WebStackProps)`) exposing `readonly bucket: Bucket` and `readonly distribution: Distribution`. `webAssetPath` defaults to the repository's `apps/web/dist`, resolved from the module location with `fileURLToPath(new URL("../../apps/web/dist", import.meta.url))`.

- [ ] **Step 1: Write the failing tests** in `web-stack.test.ts`. Build a fixture folder with `mkdtempSync(join(tmpdir(), "web-"))` containing an `index.html`, create `Template.fromStack(new WebStack(new App(), "TestWeb", { webAssetPath: fixture }))`, and clean up the fixture in `afterAll`. Tests:
  - `"blocks all public access and encrypts the bucket"`: `AWS::S3::Bucket` has `PublicAccessBlockConfiguration` with `BlockPublicAcls`, `BlockPublicPolicy`, `IgnorePublicAcls`, `RestrictPublicBuckets` all `true`, `BucketEncryption` using `AES256`, and `WebsiteConfiguration: Match.absent()`.
  - `"never allows a public principal in the bucket policy"`: across every `AWS::S3::BucketPolicy` statement with `Effect: "Allow"`, the `Principal` is neither `"*"` nor `{ AWS: "*" }`; and the SSL-enforcing `Deny` statement exists (`aws:SecureTransport` is `false`).
  - `"serves the bucket through origin access control"`: an `AWS::CloudFront::OriginAccessControl` exists, and the distribution's origin references it (`OriginAccessControlId`).
  - `"redirects HTTP to HTTPS and serves index.html"`: the distribution has `DefaultRootObject: "index.html"`, `ViewerProtocolPolicy: "redirect-to-https"`, `Compress: true`, `PriceClass: "PriceClass_100"`, and no `Aliases` / custom certificate.
  - `"answers 403 and 404 with index.html"`: `CustomErrorResponses` contains entries for 403 and 404 with `ResponsePagePath: "/index.html"` and `ResponseCode: 200`.
  - `"sets the security headers"`: the `AWS::CloudFront::ResponseHeadersPolicy` has HSTS (`AccessControlMaxAgeSec` at least 31536000, `IncludeSubdomains: true`), `ContentTypeOptions`, `FrameOptions: "DENY"`, `ReferrerPolicy: "strict-origin-when-cross-origin"`, and the distribution's default behavior references that policy.
  - `"pins the content security policy exactly"`: resolve the CSP value (it renders as an `Fn::Join` containing `{ Ref: "AWS::Region" }`) by substituting `us-east-1` for that Ref and joining, then assert equality with the exact string in the Global Constraints for `us-east-1`; also assert it contains none of `unsafe-inline`, `unsafe-eval` and has no source that is a bare `*`.
  - `"publishes the web build and invalidates the cache"`: the `Custom::CDKBucketDeployment` resource has `Prune: true` and `DistributionPaths: ["/*"]`.
  - `"outputs the site URL and bucket name"`: `template.hasOutput("WebUrl", {})` and `template.hasOutput("BucketName", {})`.
    Where the synthesized shape differs from these descriptions, trust the template and keep the intent in the test name.
- [ ] **Step 2: Run** `pnpm --filter @trackthat/infra test`. Expected: FAIL, cannot resolve `./web-stack`.
- [ ] **Step 3: Implement `WebStack` in `infra/lib/web-stack.ts`.** Use `Bucket` (`blockPublicAccess: BlockPublicAccess.BLOCK_ALL`, `encryption: BucketEncryption.S3_MANAGED`, `enforceSSL: true`), `S3BucketOrigin.withOriginAccessControl(bucket)` from `aws-cdk-lib/aws-cloudfront-origins`, a `Distribution` with the settings in the Global Constraints (`errorResponses` for 403 and 404, `priceClass: PriceClass.PRICE_CLASS_100`), a `ResponseHeadersPolicy` built from `securityHeadersBehavior` using the exact headers and CSP in the Global Constraints (build the CSP from the stack's `this.region` token), a `BucketDeployment` with `Source.asset(props.webAssetPath ?? <default>)`, `distribution`, and `distributionPaths: ["/*"]`, and two `CfnOutput`s: `WebUrl` as `https://${distribution.distributionDomainName}` and `BucketName`. Add a one-line comment on the CSP stating that it assumes the app has no inline styles or scripts.
- [ ] **Step 4: Wire it in.** In `infra/bin/app.ts` add `new WebStack(app, "TrackThatWeb")` after the existing stacks. In `.github/workflows/ci.yml` add a step `Build web` running `pnpm --filter @trackthat/web build`, placed immediately before the `CDK synth` step (the stack reads `apps/web/dist` at synth time).
- [ ] **Step 5: Verify.** Run `pnpm --filter @trackthat/web build`, then `pnpm --filter @trackthat/infra test`, `... typecheck`, `... lint`, and `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass; synth lists `TrackThatWeb` with the other stacks and makes no AWS calls. Also run `cdk synth` once with `apps/web/dist` temporarily moved aside and note in the report that it fails (confirming the CI ordering matters), then restore it.
- [ ] **Step 6: Commit** `feat(infra): add web hosting stack`.

---

### Task 2: Deploy workflow builds and publishes the web app

**Files:**

- Modify: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: repo variables `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID` (documented in Task 3), and the `TrackThatWeb` stack id from Task 1.

- [ ] **Step 1: Edit `deploy.yml`**, changing only these things:
  - Add a step `Require web build variables` immediately after the existing `Require main branch` step. Pass `vars.VITE_USER_POOL_ID` and `vars.VITE_USER_POOL_CLIENT_ID` through `env:` (never interpolate them into the script body). It fails with `::error::` naming both variables and pointing to the README "Deploying" section if either is empty.
  - Add a step `Build web` after the `Test` step and before `Configure AWS credentials`, running `pnpm --filter @trackthat/web build` with `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID` set in `env:` from the same repo variables.
  - Change the deploy command to `pnpm --filter @trackthat/infra exec cdk deploy TrackThatApi TrackThatAuth TrackThatWeb --require-approval never`.
    Do not change permissions, concurrency, the guard, `timeout-minutes`, action versions, or step order otherwise.
- [ ] **Step 2: Verify.** Run `pnpm format:check` (Prettier checks YAML). Re-read the file against the Global Constraints and Review Focus: the variables guard is second (right after the main guard) and the build step precedes credentials; no `${{ }}` inside any `run:` body; no `secrets.` references; `GithubOidcStack` is not in the deploy command. If `actionlint` is installed locally, run it; do not add it as a dependency.
- [ ] **Step 3: Commit** `feat(ci): build and deploy the web app`.

---

### Task 3: README and full verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update `README.md`.**
  - Folder Layout: the `infra` line mentions `TrackThatWeb` (static site hosting) alongside the other stacks.
  - Deploying section: replace the sentence saying only two stacks deploy and the web app is not deployed with one saying the workflow also builds and publishes the web app through `TrackThatWeb`. In the one-time setup, extend step 4 with two more repo variables, `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID`, whose values are the `UserPoolId` and `UserPoolClientId` outputs of `TrackThatAuth`, with the `gh variable set` commands. Add a short caveat: on a brand-new account those outputs do not exist yet, so deploy `TrackThatApi` and `TrackThatAuth` first with admin credentials (`pnpm --filter @trackthat/infra exec cdk deploy TrackThatApi TrackThatAuth`), then set the variables, then run the workflow. Also state that the variables must be updated if the user pool is ever recreated.
  - Add a short "Site URL" paragraph to the Deploying section: after a deploy, the `WebUrl` output of `TrackThatWeb` appears in the workflow log and is the address of the site; the URL is unlisted but public, Cognito self sign-up is open, and the default email sender allows 50 emails a day.
  - Next Steps: remove "web hosting".
  - Leave the other sections as they are.
- [ ] **Step 2: Run the CI sequence from the repo root:** `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @trackthat/web build`, then `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass. `pnpm format:check` may flag untracked scratch files under `.superpowers/`; if that is the only complaint, confirm the tracked files are clean with `pnpm exec prettier --check README.md docs .github infra`.
- [ ] **Step 3: Confirm the OIDC stack is untouched.** Run `git diff main --stat -- infra/lib/github-oidc-stack.ts infra/lib/github-oidc-stack.test.ts` and confirm it prints nothing, and that `pnpm --filter @trackthat/infra test` still passes the existing OIDC tests.
- [ ] **Step 4: Check the docs against the code.** Confirm the repo variable names in the README exactly match `vars.VITE_USER_POOL_ID` and `vars.VITE_USER_POOL_CLIENT_ID` in `deploy.yml`, the stack id `TrackThatWeb` matches `infra/bin/app.ts`, and the output name `WebUrl` matches the stack.
- [ ] **Step 5: Commit** `docs: document web hosting`.
