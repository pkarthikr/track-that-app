# Email and Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can register with email and password, confirm their email with an emailed code, sign in, and sign out of the TrackThat web app, backed by Amazon Cognito.

**Architecture:** A new CDK `AuthStack` defines the user pool and a public SRP-only app client. The web app wraps `aws-amplify/auth` behind a small `AuthApi` interface; four React screens depend only on that interface, and `App` switches between them with state (no router).

**Tech Stack:** AWS CDK (`aws-cdk-lib`), Amazon Cognito, `aws-amplify` v6 (`aws-amplify/auth` only), React 19, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-23-email-password-auth-design.md`

## Global Constraints

- Sign-in alias is email only and case-insensitive (`signInCaseSensitive: false`); self sign-up enabled; `autoVerify: { email: true }`.
- Password minimum length 8 with Cognito's default character requirements; MFA off; account recovery disabled.
- App client is public: `generateSecret: false`, only `userSrp` auth flow, token revocation enabled, access and ID token lifetimes 1 hour or less.
- Stack outputs are named `UserPoolId` and `UserPoolClientId`.
- Web config variables are `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID` only. Real values are never committed.
- Components never import Amplify; only `src/auth/config.ts` and `src/auth/auth.ts` do.
- Email verification is a 6-digit emailed code. No router library. Nothing is deployed; no live-Cognito tests.
- Out of scope: password reset, resend-code, MFA, social login, profile, API protection.
- Match existing style: double quotes, semicolons, `import type` for types (`verbatimModuleSyntax`), tests co-located as `*.test.ts(x)`, Vitest imports explicit (`describe`, `it`, `expect` from `"vitest"`; globals are off). Run `pnpm format` before each commit.
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Email typed with surrounding whitespace or different casing: it is trimmed before it reaches Cognito, and the pool treats `A@x.com` and `a@x.com` as one account. Pinned in Task 1 (case-insensitive pool) and Task 3 (trim).
- Double-clicking a submit button: the button is disabled while the request is pending, so only one request is sent. Pinned in Task 4.
- A password that fails the pool policy: the user sees the actual requirements, not "Something went wrong". Pinned in Task 3 (`messageFor`) and Task 4.
- A user who registered but never confirmed tries to sign in: they are sent to the Confirm screen, whether Amplify throws or returns the `CONFIRM_SIGN_UP` next step. Pinned in Task 3 and Task 5.
- Missing `VITE_*` variables at startup: a message naming each missing variable, not a blank page. Pinned in Task 2 (throws) and Task 5 (`main.tsx` renders the message).

---

### Task 1: Cognito `AuthStack`

**Files:**

- Create: `infra/lib/auth-stack.ts`
- Create: `infra/lib/auth-stack.test.ts`
- Modify: `infra/bin/app.ts`
- Modify: `infra/package.json` (add `vitest` devDependency at the same range as `apps/web`, i.e. `^5.0.3`; replace the `test` script `echo` placeholder with `vitest run`)

**Interfaces:**

- Produces: `export class AuthStack extends Stack` (constructor `(scope: Construct, id: string, props?: StackProps)`) exposing `readonly userPool: UserPool` and `readonly userPoolClient: UserPoolClient`.

- [ ] **Step 1: Write the failing test** in `infra/lib/auth-stack.test.ts`, using `Template.fromStack(new AuthStack(new App(), "TestAuth"))`. Tests, each asserting with `hasResourceProperties` unless noted:
  - `"signs in by email, case-insensitively, with email auto-verified"`: `AWS::Cognito::UserPool` has `UsernameAttributes: ["email"]`, `AutoVerifiedAttributes: ["email"]`, `UsernameConfiguration: { CaseSensitive: false }`.
  - `"enforces an 8 character minimum password and no MFA or account recovery"`: `Policies.PasswordPolicy.MinimumLength: 8`, `MfaConfiguration: "OFF"`, `AccountRecoverySetting.RecoveryMechanisms` is `[{ Name: "admin_only", Priority: 1 }]`.
  - `"creates a public SRP-only client with token revocation"`: `AWS::Cognito::UserPoolClient` has `ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]` and `EnableTokenRevocation: true`; `GenerateSecret` must not be `true` (use `Match.absent()` if CDK omits it, otherwise `false`; check the synthesized template).
  - `"uses 1 hour access and ID tokens"`: `AccessTokenValidity: 60`, `IdTokenValidity: 60`, `TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes" }`.
  - `"outputs the pool and client ids"`: `template.hasOutput("UserPoolId", {})` and `template.hasOutput("UserPoolClientId", {})`.
- [ ] **Step 2: Run** `pnpm --filter @trackthat/infra install` then `pnpm --filter @trackthat/infra test`. Expected: FAIL, cannot resolve `./auth-stack`.
- [ ] **Step 3: Implement `AuthStack` in `infra/lib/auth-stack.ts`** with the Global Constraints values: `UserPool` (`signInAliases: { email: true }`, `signInCaseSensitive: false`, `selfSignUpEnabled: true`, `autoVerify: { email: true }`, `passwordPolicy: { minLength: 8 }`, `mfa: Mfa.OFF`, `accountRecovery: AccountRecovery.NONE`) and `userPool.addClient` (`generateSecret: false`, `authFlows: { userSrp: true }`, `enableTokenRevocation: true`, `accessTokenValidity` and `idTokenValidity` of `Duration.hours(1)`), plus two `CfnOutput`s. If an assertion's expected shape differs from the synthesized template, trust the template for CDK's own rendering but keep the intent in the test name.
- [ ] **Step 4: Instantiate it in `infra/bin/app.ts`** as `new AuthStack(app, "TrackThatAuth")`.
- [ ] **Step 5: Verify.** Run `pnpm --filter @trackthat/infra test`, `pnpm --filter @trackthat/infra typecheck`, `pnpm --filter @trackthat/infra lint`, and `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass, and synth lists `TrackThatAuth` with no AWS calls.
- [ ] **Step 6: Commit** `feat(infra): add Cognito AuthStack`.

---

### Task 2: Web foundation: dependency, test cleanup, config

**Files:**

- Modify: `apps/web/package.json` (via `pnpm --filter @trackthat/web add aws-amplify`)
- Modify: `apps/web/vite.config.ts` (add `setupFiles: ["./src/test-setup.ts"]` under `test`)
- Create: `apps/web/src/test-setup.ts`
- Modify: `.gitignore`
- Create: `apps/web/.env.example`
- Create: `apps/web/src/auth/config.ts`
- Create: `apps/web/src/auth/config.test.ts`

**Interfaces:**

- Produces: `export type AuthConfig = { userPoolId: string; userPoolClientId: string }`; `export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig` (throws `Error` whose message names every missing variable); `export function configureAuth(env?: Record<string, string | undefined>): void` (defaults to `import.meta.env`, calls `readAuthConfig`, then `Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } })`).

- [ ] **Step 1: Add the dependency** with `pnpm --filter @trackthat/web add aws-amplify`. It should resolve to a 6.x release; if it resolves to a newer major, check the `aws-amplify` and `aws-amplify/auth` export names used in Task 3 before continuing.
- [ ] **Step 2: Add `src/test-setup.ts`** that calls `afterEach(cleanup)` (from `vitest` and `@testing-library/react`). Without Vitest globals, Testing Library does not auto-clean between tests, so multi-render test files would see leftover DOM. Wire it with `setupFiles` in `vite.config.ts`.
- [ ] **Step 3: Un-ignore the example file.** `.gitignore` has `.env*`, which would ignore `.env.example`; add the line `!.env.example` after it. Create `apps/web/.env.example` with the two variable names and empty values, plus a one-line comment saying values come from the `UserPoolId` and `UserPoolClientId` stack outputs. Verify with `git check-ignore apps/web/.env.example` (expected: no output).
- [ ] **Step 4: Write the failing tests** in `config.test.ts` for `readAuthConfig`:
  - `"returns both values when present"`.
  - `"throws naming VITE_USER_POOL_ID when it is missing"`.
  - `"throws naming both variables when both are missing"` (message contains both names).
  - `"treats an empty string as missing"`.
- [ ] **Step 5: Run** `pnpm --filter @trackthat/web test`. Expected: FAIL, cannot resolve `./config`.
- [ ] **Step 6: Implement `readAuthConfig` and `configureAuth`** in `config.ts` per the Interfaces block.
- [ ] **Step 7: Verify.** Run `pnpm --filter @trackthat/web test`, `... typecheck`, `... lint`. Expected: pass, including the existing `App.test.tsx`.
- [ ] **Step 8: Commit** `feat(web): add Amplify dependency and auth config`.

---

### Task 3: Auth wrapper

**Files:**

- Create: `apps/web/src/auth/auth.ts`
- Create: `apps/web/src/auth/auth.test.ts`
- Create: `apps/web/src/auth/messages.ts`
- Create: `apps/web/src/auth/messages.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks at runtime. (`configureAuth` runs before any `authApi` call, in Task 5.)
- Produces, from `auth.ts`:
  - `export type AuthErrorCode = "user-exists" | "invalid-credentials" | "user-not-confirmed" | "invalid-code" | "expired-code" | "invalid-password" | "unknown"`
  - `export class AuthFailure extends Error { readonly code: AuthErrorCode; constructor(code: AuthErrorCode, options?: { cause?: unknown }) }`
  - `export interface AuthApi { signUp(email: string, password: string): Promise<void>; confirmSignUp(email: string, code: string): Promise<void>; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; getCurrentUser(): Promise<string | null> }` (`getCurrentUser` resolves to the user's email or `null`)
  - `export const authApi: AuthApi`
- Produces, from `messages.ts`: `export function messageFor(code: AuthErrorCode): string`.

- [ ] **Step 1: Write the failing tests** in `auth.test.ts`, mocking `aws-amplify/auth` with `vi.mock` (functions `signUp`, `confirmSignUp`, `signIn`, `signOut`, `getCurrentUser`, `fetchUserAttributes`):
  - `"signUp sends the trimmed email as username and as the email attribute"`: input `"  a@x.com "` leads to `signUp({ username: "a@x.com", password, options: { userAttributes: { email: "a@x.com" } } })`.
  - `"confirmSignUp sends the trimmed email and the code"`.
  - `"signIn resolves when Amplify reports isSignedIn"`.
  - `"signIn throws user-not-confirmed when Amplify returns the CONFIRM_SIGN_UP next step"`.
  - `"maps Amplify error names to codes"`, table-driven: `UsernameExistsException` to `user-exists`, `NotAuthorizedException` to `invalid-credentials`, `UserNotFoundException` to `invalid-credentials` (so sign-in does not reveal whether an account exists), `UserNotConfirmedException` to `user-not-confirmed`, `CodeMismatchException` to `invalid-code`, `ExpiredCodeException` to `expired-code`, `InvalidPasswordException` to `invalid-password`, anything else to `unknown`. Each rejects with an `AuthFailure` carrying that `code`.
  - `"getCurrentUser returns the email attribute when signed in"` (via `fetchUserAttributes`) and `"getCurrentUser returns null when Amplify throws"`.
  - `"signOut calls Amplify signOut"`.
- [ ] **Step 2: Write the failing test** in `messages.test.ts`: `messageFor` returns a non-empty string for every `AuthErrorCode`, and `messageFor("invalid-password")` contains `"8 characters"`.
- [ ] **Step 3: Run** `pnpm --filter @trackthat/web test`. Expected: FAIL, modules not found.
- [ ] **Step 4: Implement `auth.ts`.** Trim the email in `signUp`, `confirmSignUp`, and `signIn`. Convert any thrown value to `AuthFailure` through one internal `toAuthFailure(error: unknown): AuthFailure` keyed on `error.name`, and let an existing `AuthFailure` pass through unchanged.
- [ ] **Step 5: Implement `messageFor` in `messages.ts`.** One short sentence per code. The `invalid-password` message must state the real policy: at least 8 characters with upper and lower case letters, a number, and a symbol (the pool's defaults from Task 1). `unknown` reads "Something went wrong. Please try again."
- [ ] **Step 6: Verify** with `pnpm --filter @trackthat/web test`, `... typecheck`, `... lint`. Expected: pass.
- [ ] **Step 7: Commit** `feat(web): add auth wrapper and error messages`.

---

### Task 4: Register, Confirm, and Sign-in screens

**Files:**

- Create: `apps/web/src/screens/Register.tsx`, `Confirm.tsx`, `SignIn.tsx`
- Create: `apps/web/src/screens/Register.test.tsx`, `Confirm.test.tsx`, `SignIn.test.tsx`

**Interfaces:**

- Consumes: `AuthApi`, `AuthFailure` from `../auth/auth`; `messageFor` from `../auth/messages`.
- Produces (named exports; screens take the `auth` prop so tests inject a fake):
  - `Register({ auth, onRegistered, onShowSignIn }: { auth: AuthApi; onRegistered: (email: string) => void; onShowSignIn: () => void })`
  - `Confirm({ auth, email, onConfirmed }: { auth: AuthApi; email: string; onConfirmed: () => void })`
  - `SignIn({ auth, onSignedIn, onNeedsConfirmation, onShowRegister }: { auth: AuthApi; onSignedIn: (email: string) => void; onNeedsConfirmation: (email: string) => void; onShowRegister: () => void })`

Each screen is a `<form>` with labelled inputs (label text "Email", "Password", "Confirmation code"), required fields, `type="email"` / `type="password"` / `inputMode="numeric"` as appropriate, a submit button, and an `role="alert"` element showing `messageFor(code)` when a call fails. Headings: "Create your account", "Confirm your email", "Sign in". Use `fireEvent` from `@testing-library/react` (no `user-event` dependency).

- [ ] **Step 1: Write the failing tests** with a fake `AuthApi` built from `vi.fn()`s:
  - Register: `"calls signUp with the entered email and password, then onRegistered(email)"`; `"shows the user-exists message and stays put on failure"`; `"shows the password requirements on invalid-password"` (alert text contains `"8 characters"`); `"disables the submit button while the request is pending and sends one request"` (fire submit twice on an unresolved promise; `signUp` called once; button `disabled`); `"links to sign in"` (clicking calls `onShowSignIn`).
  - Confirm: `"calls confirmSignUp with the email prop and entered code, then onConfirmed"`; `"shows the invalid-code message on failure"`; `"shows the expired-code message on failure"`.
  - SignIn: `"calls signIn then onSignedIn(email)"`; `"calls onNeedsConfirmation(email) when signIn rejects with user-not-confirmed"`; `"shows the invalid-credentials message on failure"`; `"disables the submit button while pending"`; `"links to register"`.
- [ ] **Step 2: Run** `pnpm --filter @trackthat/web test`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the three screens** to the signatures above. Failures that are not `AuthFailure` display `messageFor("unknown")`. Clear the alert when a new submit starts.
- [ ] **Step 4: Verify** with `pnpm --filter @trackthat/web test`, `... typecheck`, `... lint`. Expected: pass.
- [ ] **Step 5: Commit** `feat(web): add register, confirm, and sign-in screens`.

---

### Task 5: Signed-in view, `App` wiring, startup

**Files:**

- Create: `apps/web/src/screens/SignedIn.tsx`, `apps/web/src/screens/SignedIn.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**

- Consumes: the three screens (Task 4), `AuthApi` / `authApi` (Task 3), `configureAuth` (Task 2).
- Produces: `SignedIn({ email, onSignOut }: { email: string; onSignOut: () => void })` (heading "Welcome", the email text, a "Sign out" button); `App({ auth = authApi }: { auth?: AuthApi })`.

- [ ] **Step 1: Write the failing tests.** `SignedIn.test.tsx`: `"shows the email"` and `"calls onSignOut when Sign out is clicked"`. Replace `App.test.tsx` (the old "Hello TrackThat" assertion no longer applies) with a fake `AuthApi`:
  - `"restores an existing session"`: `getCurrentUser` resolves `"a@x.com"`, so the Welcome view and the email appear.
  - `"shows sign in when there is no session"`: `getCurrentUser` resolves `null`, so the "Sign in" heading appears.
  - `"register, confirm, sign in, sign out"`: walk the whole flow with the fake, ending back on "Sign in" after `signOut` is called.
  - `"sends an unconfirmed user from sign in to confirm"`: `signIn` rejects `new AuthFailure("user-not-confirmed")`, so "Confirm your email" appears.
  - `"shows nothing but a loading state before the session check resolves"` (no form is rendered yet).
- [ ] **Step 2: Run** `pnpm --filter @trackthat/web test`. Expected: FAIL.
- [ ] **Step 3: Implement `SignedIn` and `App`.** `App` holds a discriminated-union `view` state (`loading`, `register`, `confirm` with email, `signIn`, `signedIn` with email), calls `auth.getCurrentUser()` once on mount to leave `loading`, and routes per the Task 4 callbacks. After `onConfirmed` go to `signIn`; after `signOut` resolves go to `signIn`.
- [ ] **Step 4: Update `main.tsx`.** Call `configureAuth()` inside a `try`; on error, render a visible message with the error text instead of `App` (this is the missing-variable startup path from Review Focus). Otherwise render `App` as today.
- [ ] **Step 5: Verify** with `pnpm --filter @trackthat/web test`, `... typecheck`, `... lint`, and `pnpm --filter @trackthat/web build`. Expected: pass and `apps/web/dist` produced. Then run `pnpm --filter @trackthat/web dev` without a `.env` and confirm the page shows the missing-variables message (stop the dev server afterwards).
- [ ] **Step 6: Commit** `feat(web): add signed-in view and wire auth flow into App`.

---

### Task 6: Documentation and full verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update `README.md`.** In the Folder Layout, change the `infra` line to mention the `AuthStack`, and the `web` line to mention the auth screens. Add a short "Authentication" section: Cognito user pool with email and password sign-up, emailed confirmation code, the two `VITE_*` variables (copy `apps/web/.env.example` to `apps/web/.env.local` and fill from the `UserPoolId` and `UserPoolClientId` stack outputs after the first deploy), and the manual smoke test from the spec (register, receive code, confirm, sign in, sign out, reload keeps the session). Update "Next Steps" to drop nothing that is still true and add: resend confirmation code, password reset, protect API routes.
- [ ] **Step 2: Run the CI sequence from the repo root:** `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass. Fix any formatting with `pnpm format` and re-run.
- [ ] **Step 3: Commit** `docs: document the auth setup`.
