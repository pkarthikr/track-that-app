# Custom Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `WebStack` can serve the app on a custom domain (`track-that.com`) with a `www` -> apex redirect, configured through two repo variables, with the cutover runbook documented.

**Architecture:** `WebStack` takes optional `domainName` and `certificateArn` props. When both are set, the CloudFront distribution gets the apex and `www.` aliases, an imported ACM certificate, and a viewer-request CloudFront Function that 301s `www` to the apex. `bin/app.ts` reads `WEB_DOMAIN` and `WEB_CERT_ARN` from the environment, and the Deploy workflow passes them from repo variables. Unset config leaves today's behavior unchanged.

**Tech Stack:** AWS CDK (`aws-cdk-lib`: CloudFront, ACM), Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-01-custom-domain-design.md`

## Global Constraints

- Aliases are exactly `[domainName, "www." + domainName]`.
- The viewer certificate is imported with `Certificate.fromCertificateArn`, SNI, minimum protocol `TLS_V1_2_2021`.
- The `www` redirect is a 301 to `https://<domainName><uri><querystring>`; the apex passes through.
- Exactly one of `domainName` / `certificateArn` set throws an error naming both props. A `certificateArn` not in `us-east-1` throws.
- Empty-string env vars count as unset.
- Unset config: no `Aliases`, no `ViewerCertificate`, `WebUrl` is the cloudfront.net URL (today's behavior).
- Outputs: `WebUrl` is `https://<domainName>` when configured; new `DistributionDomain` is `distribution.distributionDomainName`.
- CSP, HSTS, other security headers, bucket, SPA 403/404 fallback, and Cognito are unchanged.
- No real AWS, GitHub, or Cloudflare resource is created or changed by this plan. The cutover runbook is documentation only.

## Review Focus

- `domainName` that already starts with `www.` -> throws (it would create `www.www.` aliases). Pinned in Task 1.
- `domainName` with uppercase letters or a trailing dot -> throws (CloudFront aliases are lowercase hostnames). Pinned in Task 1.
- `www` request with a path and query string (`/habits?x=1`) -> redirect keeps both. Pinned in Task 1.
- A host that merely starts with `www` (`wwwfoo.track-that.com`) -> not redirected. Pinned in Task 1.
- Empty-string `WEB_DOMAIN` / `WEB_CERT_ARN` (an unset GitHub variable expands to empty) -> treated as unset. Pinned in Task 2.

---

### Task 1: Custom domain support in `WebStack`

**Files:**
- Modify: `infra/lib/web-stack.ts`
- Test: `infra/lib/web-stack.test.ts`

**Interfaces:**
- Produces: `WebStackProps` gains `readonly domainName?: string` and `readonly certificateArn?: string`. Exports `wwwRedirectFunctionCode(domainName: string): string` (the CloudFront Function source). Task 2 passes the two props.

- [ ] **Step 1: Write failing tests in `infra/lib/web-stack.test.ts`**

Add a helper `synthWeb(props)` that builds a `WebStack` with `webAssetPath: fixture` plus the given props and returns its `Template`, and a constant `cert = "arn:aws:acm:us-east-1:123456789012:certificate/abc"`. Keep the existing top-level template and tests (the unset case); the existing `Aliases: Match.absent()` assertion stays. Add a `describe("WebStack with a custom domain")` block with tests:
  - `"adds both aliases and the imported certificate"`: `Aliases` equals `["track-that.com", "www.track-that.com"]`; `ViewerCertificate` is `Match.objectLike({ AcmCertificateArn: cert, SslSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2021" })`.
  - `"attaches a viewer-request function to the default behavior"`: one `AWS::CloudFront::Function` exists and `DefaultCacheBehavior.FunctionAssociations` contains an entry with `EventType: "viewer-request"`.
  - `"redirects www to the apex and keeps path and query"`: evaluate `wwwRedirectFunctionCode("track-that.com")` in a `new Function` harness exposing `handler`; with host `www.track-that.com`, uri `/habits`, querystring object `{ x: { value: "1" } }` the response has `statusCode` 301 and `location.value` `https://track-that.com/habits?x=1`; with no querystring the location has no `?`.
  - `"does not redirect the apex or look-alike hosts"`: for hosts `track-that.com` and `wwwfoo.track-that.com` the handler returns the original request object.
  - `"points WebUrl at the domain and exposes DistributionDomain"`: outputs `WebUrl` value `https://track-that.com`, and `DistributionDomain` exists.
  - `"rejects half-configured props"`: constructing with only `domainName`, and with only `certificateArn`, each throws an error matching `/domainName.*certificateArn/`.
  - `"rejects a certificate outside us-east-1"`: ARN with `eu-west-1` throws matching `/us-east-1/`.
  - `"rejects a domain that starts with www., has uppercase letters, or ends with a dot"`: `www.track-that.com`, `Track-That.com`, and `track-that.com.` each throw matching `/domainName/`.

  The CloudFront Function code is a plain JS string, so the harness runs it directly: `new Function(code + "; return handler;")()`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-stack.test.ts`
Expected: new tests FAIL (props and `wwwRedirectFunctionCode` do not exist); existing tests PASS.

- [ ] **Step 3: Implement in `infra/lib/web-stack.ts`**

- Extend `WebStackProps` with `domainName` and `certificateArn`.
- Export `wwwRedirectFunctionCode(domainName: string): string` returning ES5-compatible CloudFront Functions JS (runtime `cloudfront-js-2.0` is fine) defining `handler(event)`: if `event.request.headers.host.value === "www." + domainName`, return `{ statusCode: 301, statusDescription: "Moved Permanently", headers: { location: { value } } }` where value is `https://<domainName>` + `uri` + (`?` + querystring when non-empty, built from `event.request.querystring` entries in object order, values joined as `key=value`). Otherwise return `event.request`.
- Add a small validator `resolveDomainConfig(props)` (module-private) that returns `undefined` when both are unset, throws on exactly-one-set with a message naming both props, validates `domainName` against `/^(?!www\.)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/`, and requires the ARN's region segment (`arn.split(":")[3]`) to equal `us-east-1`.
- When configured, pass `domainNames`, `certificate: Certificate.fromCertificateArn(this, "SiteCertificate", arn)`, `minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021`, `sslSupportMethod: SSLMethod.SNI` to `Distribution`, and `functionAssociations: [{ function: new Function(this, "WwwRedirect", { code: FunctionCode.fromInline(wwwRedirectFunctionCode(domainName)), runtime: FunctionRuntime.JS_2_0 }), eventType: FunctionEventType.VIEWER_REQUEST }]` on the default behavior. Unset leaves both out.
- `WebUrl` output uses the domain when configured. Add `DistributionDomain` output.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-stack.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm --filter @trackthat/infra typecheck && pnpm --filter @trackthat/infra lint`
Expected: no errors.

```bash
git add infra/lib/web-stack.ts infra/lib/web-stack.test.ts
git commit -m "feat(infra): serve the web app on a custom domain with a www redirect"
```

---

### Task 2: Wire the domain through the app entry and the Deploy workflow

**Files:**
- Modify: `infra/bin/app.ts`
- Modify: `.github/workflows/deploy.yml`
- Create: `infra/lib/web-domain-config.ts`
- Test: `infra/lib/web-domain-config.test.ts`

**Interfaces:**
- Consumes: Task 1's `WebStackProps.domainName` / `certificateArn`.
- Produces: `readWebDomainConfig(env: Record<string, string | undefined>): { domainName?: string; certificateArn?: string }`, used only by `bin/app.ts`.

- [ ] **Step 1: Write failing tests in `infra/lib/web-domain-config.test.ts`**
  - `"returns both values when both are set"`.
  - `"treats empty strings as unset"`: `{ WEB_DOMAIN: "", WEB_CERT_ARN: "" }` returns `{}` (no keys).
  - `"returns an empty object when neither is set"`.
  - `"passes a lone value through so WebStack can reject it"`: only `WEB_DOMAIN` set returns `{ domainName }`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @trackthat/infra exec vitest run lib/web-domain-config.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**
  - `readWebDomainConfig` in `infra/lib/web-domain-config.ts`: reads `WEB_DOMAIN` and `WEB_CERT_ARN`, omits empty or undefined keys.
  - `infra/bin/app.ts`: `new WebStack(app, "TrackThatWeb", readWebDomainConfig(process.env))`.
  - `.github/workflows/deploy.yml`: in the "Require web build variables" step add `WEB_DOMAIN` / `WEB_CERT_ARN` env from `vars.*` and fail with an `::error::` pointing at the README "Custom domain" section when exactly one of the two is non-empty. In the "CDK deploy" step add `env: WEB_DOMAIN: ${{ vars.WEB_DOMAIN }}` and `WEB_CERT_ARN: ${{ vars.WEB_CERT_ARN }}`.

- [ ] **Step 4: Run to verify pass and that synth is unchanged when unset**

Run: `pnpm --filter @trackthat/infra exec vitest run && pnpm --filter @trackthat/web build && pnpm --filter @trackthat/infra synth --quiet`
Expected: tests PASS; synth succeeds with no aliases (the variables are unset locally).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add infra/bin/app.ts infra/lib/web-domain-config.ts infra/lib/web-domain-config.test.ts .github/workflows/deploy.yml
git commit -m "feat(infra): read the web domain and certificate from the deploy environment"
```

---

### Task 3: Document the domain config and cutover runbook

**Files:**
- Modify: `README.md` (add a `### Custom domain` subsection under `## Deploying`, after the "Site URL" paragraph; update that paragraph to say `WebUrl` is the custom domain once configured)

**Interfaces:**
- Consumes: variable names `WEB_DOMAIN`, `WEB_CERT_ARN` and output `DistributionDomain` from Tasks 1 and 2.

- [ ] **Step 1: Write the section**

Contents, matching the spec's runbook: the two optional repo variables and that both or neither must be set; the seven cutover steps (nameservers to Cloudflare; ACM request in us-east-1 for both names with the validation CNAME added DNS-only in Cloudflare; set the variables; run Deploy; read `DistributionDomain` and add DNS-only CNAMEs for the apex and `www` in Cloudflare; browser verification list; delete the `track-that.pkarthikr.in` record); the note to keep the validation CNAME for renewals; and that Cloudflare must stay DNS-only. Include the ACM request as a `aws acm request-certificate --region us-east-1 --domain-name track-that.com --subject-alternative-names www.track-that.com --validation-method DNS` example and the `gh variable set` lines, labeled as commands for the owner to run.

- [ ] **Step 2: Verify**

Run: `pnpm format:check 2>/dev/null || pnpm lint`
Expected: no errors. Read the section once for accuracy against the spec.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add the custom domain setup and cutover runbook"
```
