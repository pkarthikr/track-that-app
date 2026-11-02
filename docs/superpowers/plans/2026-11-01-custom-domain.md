# Custom Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-merged optional custom domain configurable (`WEB_DOMAIN`), add the `www` alias with a `www` -> apex redirect, and document the cutover to `track-that.com`.

**Architecture:** Builds on `e3704ef`: `WebStack` already takes `customDomain: { domainName, certificateArn }` and `bin/app.ts` hardcodes `track-that.pkarthikr.in`. This plan adds an optional `includeWww` flag (aliases plus a viewer-request CloudFront Function), synth-time validation, and a `WEB_DOMAIN` env var read by `bin/app.ts`. Unset `WEB_DOMAIN` keeps today's deployed behavior.

**Tech Stack:** AWS CDK (`aws-cdk-lib`: CloudFront, ACM), Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-01-custom-domain-design.md`

## Global Constraints

- Existing names stay: prop `customDomain`, env/repo variable `WEB_CERTIFICATE_ARN`, output `DistributionDomainName`. The existing custom-domain tests must keep passing unchanged.
- `WEB_DOMAIN` unset or empty -> `domainName` is `track-that.pkarthikr.in` and `includeWww` is false (one alias, no function, as today).
- `includeWww: true` -> aliases exactly `[domainName, "www." + domainName]`; function code 301s host `www.<domainName>` to `https://<domainName><uri><querystring>`, other hosts pass through.
- Distribution sets `minimumProtocolVersion` `SecurityPolicyProtocol.TLS_V1_2_2021` whenever `customDomain` is set.
- Validation (throws in the `WebStack` constructor): `domainName` lowercase hostname, no trailing dot, no leading `www.`; `certificateArn` region (`arn.split(":")[3]`) is `us-east-1`.
- `WebUrl` is `https://<domainName>` when `customDomain` is set, else the cloudfront.net URL. CSP, HSTS, headers, bucket, SPA fallback, Cognito, API CORS unchanged.
- No real AWS, GitHub, or Cloudflare resource is created or changed by this plan; the cutover runbook is documentation only.

## Review Focus

- `domainName` starting with `www.`, containing uppercase, or ending with a dot -> throws. Pinned in Task 1.
- `www` request with path and query (`/habits?x=1`) -> redirect keeps both. Pinned in Task 1.
- Look-alike host (`wwwfoo.track-that.com`) and the apex -> not redirected. Pinned in Task 1.
- `includeWww` false/unset -> no `www` alias and no `AWS::CloudFront::Function` (legacy hostname must not break). Pinned in Task 1.
- Empty-string `WEB_DOMAIN` (an unset GitHub variable expands to empty) -> treated as unset. Pinned in Task 2.

---

### Task 1: `includeWww`, redirect function, and validation in `WebStack`

**Files:**
- Modify: `infra/lib/web-stack.ts`
- Test: `infra/lib/web-stack.test.ts`

**Interfaces:**
- Consumes: existing `WebCustomDomain { domainName: string; certificateArn: string }` and the `customDomain` prop.
- Produces: `WebCustomDomain.includeWww?: boolean`; exported `wwwRedirectFunctionCode(domainName: string): string` (CloudFront Function source defining `handler(event)`). Task 2 passes `includeWww`.

- [ ] **Step 1: Write failing tests in `infra/lib/web-stack.test.ts`**

Reuse the existing custom-domain test setup (`certificateArn`, `fixture`). Add a `describe("WebStack with includeWww")` block, and keep all existing tests as they are. Tests:
  - `"adds the www alias alongside the apex"`: `Aliases` equals `["track-that.example.com", "www.track-that.example.com"]` and `ViewerCertificate` includes `MinimumProtocolVersion: "TLSv1.2_2021"`.
  - `"attaches a viewer-request function"`: exactly one `AWS::CloudFront::Function` exists and the default behavior has a `FunctionAssociations` entry with `EventType: "viewer-request"`.
  - `"adds no function and no www alias when includeWww is not set"`: with the existing single-alias setup, `Aliases` is `["track-that.example.com"]` and `template.resourceCountIs("AWS::CloudFront::Function", 0)`.
  - `"redirects www to the apex and keeps path and query"`: load `wwwRedirectFunctionCode("track-that.com")` with `new Function(code + "; return handler;")()`; host `www.track-that.com`, uri `/habits`, querystring `{ x: { value: "1" } }` returns `statusCode` 301 and `headers.location.value` `https://track-that.com/habits?x=1`; with an empty querystring `{}` the location has no `?`.
  - `"does not redirect the apex or look-alike hosts"`: hosts `track-that.com` and `wwwfoo.track-that.com` return the original request object.
  - `"points WebUrl at the domain"`: output `WebUrl` is `https://track-that.example.com` when `customDomain` is set.
  - `"rejects an invalid domain"`: `www.track-that.com`, `Track-That.com`, and `track-that.com.` each throw matching `/domainName/`.
  - `"rejects a certificate outside us-east-1"`: an `eu-west-1` ARN throws matching `/us-east-1/`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-stack.test.ts`
Expected: new tests FAIL; the existing tests PASS.

- [ ] **Step 3: Implement in `infra/lib/web-stack.ts`**

- Add `readonly includeWww?: boolean` to `WebCustomDomain`.
- Export `wwwRedirectFunctionCode(domainName: string): string` returning CloudFront Functions JS (`cloudfront-js-2.0`) with `handler(event)`: if `event.request.headers.host.value === "www." + domainName`, return `{ statusCode: 301, statusDescription: "Moved Permanently", headers: { location: { value } } }` where `value` is `https://<domainName>` + `uri` + (`?` + `key=value` pairs joined by `&` when the querystring is non-empty); otherwise return `event.request`.
- Module-private `validateCustomDomain(customDomain: WebCustomDomain): void` that throws per the Global Constraints (messages mention `domainName` / `us-east-1`); call it at the top of the constructor when `customDomain` is set. Use the domain regex `/^(?!www\.)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/`.
- In the `Distribution` custom-domain spread: `domainNames` becomes the apex plus (when `includeWww`) the `www.` name; add `minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021`; when `includeWww`, add a `functionAssociations` entry on the default behavior with `new Function(this, "WwwRedirect", { code: FunctionCode.fromInline(wwwRedirectFunctionCode(domainName)), runtime: FunctionRuntime.JS_2_0 })` and `FunctionEventType.VIEWER_REQUEST`.
- `WebUrl` output uses `https://<domainName>` when `customDomain` is set. Leave `DistributionDomainName` as is.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-stack.test.ts`
Expected: all tests PASS, including the pre-existing ones.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm --filter @trackthat/infra typecheck && pnpm --filter @trackthat/infra lint`
Expected: no errors.

```bash
git add infra/lib/web-stack.ts infra/lib/web-stack.test.ts
git commit -m "feat(infra): add the www alias and redirect for the custom domain"
```

---

### Task 2: Read `WEB_DOMAIN` in the app entry and the Deploy workflow

**Files:**
- Create: `infra/lib/web-domain-config.ts`
- Test: `infra/lib/web-domain-config.test.ts`
- Modify: `infra/bin/app.ts`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Task 1's `WebCustomDomain.includeWww`.
- Produces: `resolveWebCustomDomain(env: Record<string, string | undefined>): WebCustomDomain | undefined` (imported from `./web-stack` type). Returns `undefined` when `WEB_CERTIFICATE_ARN` is unset or empty; otherwise `{ domainName, certificateArn, includeWww }` where `domainName` is `WEB_DOMAIN` or `track-that.pkarthikr.in` when `WEB_DOMAIN` is unset or empty, and `includeWww` is true exactly when `WEB_DOMAIN` is non-empty.

- [ ] **Step 1: Write failing tests in `infra/lib/web-domain-config.test.ts`**
  - `"returns undefined without a certificate ARN"` (also for an empty string).
  - `"falls back to the legacy hostname without www"`: only the ARN set -> `{ domainName: "track-that.pkarthikr.in", certificateArn, includeWww: false }`.
  - `"uses WEB_DOMAIN and enables www"`: both set -> `{ domainName: "track-that.com", certificateArn, includeWww: true }`.
  - `"treats an empty WEB_DOMAIN as unset"`: `WEB_DOMAIN: ""` behaves like the fallback case.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-domain-config.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**
  - `resolveWebCustomDomain` in `infra/lib/web-domain-config.ts`.
  - `infra/bin/app.ts`: replace the inline `webCertificateArn` logic with `const customDomain = resolveWebCustomDomain(process.env)` and `...(customDomain === undefined ? {} : { customDomain })` in the `WebStack` props.
  - `.github/workflows/deploy.yml`: add `WEB_DOMAIN: ${{ vars.WEB_DOMAIN }}` to the CDK deploy step's `env`, next to `WEB_CERTIFICATE_ARN`.

- [ ] **Step 4: Run to verify pass and that synth still works**

Run: `pnpm --filter @trackthat/infra exec vitest run && pnpm --filter @trackthat/web build && pnpm --filter @trackthat/infra synth --quiet`
Expected: tests PASS; synth succeeds.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add infra/bin/app.ts infra/lib/web-domain-config.ts infra/lib/web-domain-config.test.ts .github/workflows/deploy.yml
git commit -m "feat(infra): take the web domain from the WEB_DOMAIN variable"
```

---

### Task 3: Document the domain config and cutover runbook

**Files:**
- Modify: `README.md` (add a `### Custom domain` subsection under `## Deploying`, after the "Site URL" paragraph)

**Interfaces:**
- Consumes: `WEB_DOMAIN`, `WEB_CERTIFICATE_ARN`, output `DistributionDomainName`.

- [ ] **Step 1: Write the section**

Contents, matching the spec's runbook: the two optional repo variables (`WEB_CERTIFICATE_ARN` required for any custom domain; `WEB_DOMAIN` unset keeps `track-that.pkarthikr.in`); the seven cutover steps, including that step 4's deploy swaps alias and certificate in place and ends service on the old hostname, and the tip to create the Cloudflare records before the deploy; the note to keep the new certificate's validation CNAME for renewals; Cloudflare stays DNS-only. Include `aws acm request-certificate --region us-east-1 --domain-name track-that.com --subject-alternative-names www.track-that.com --validation-method DNS` and the `gh variable set` lines as commands for the owner to run.

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: no errors. Read the section once against the spec.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add the custom domain setup and cutover runbook"
```
