# Shared Auth Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract TrackThat's auth (client library, React screens, CDK construct) into a new `ideas-toolkit` monorepo published as private `@pkarthikr/*` packages, then migrate TrackThat onto them with no behavior change.

**Architecture:** A pnpm workspace with three packages under `packages/auth/` (`client`, `react`, `cdk`), each built with `tsup` and released with Changesets to GitHub Packages. `auth-react` gets its `AuthApi`, app name, paths and link component from an `AuthProvider`, renders only content (no page chrome), and is themed by `--auth-*` CSS variables. TrackThat then replaces its local auth code with the packages.

**Tech Stack:** pnpm, TypeScript, tsup, Vitest, React 19, Testing Library, aws-amplify v6, aws-cdk-lib, Changesets.

**Spec:** `docs/superpowers/specs/2026-10-30-shared-auth-toolkit-design.md`

## Locations

- `$TT` = `/Users/pkarthikr/Work/Projects/Track That/track-that-app/.claude/worktrees/auth-screens` (the TrackThat worktree, branch `shared-auth-toolkit`; Tasks 8-9 happen here). Existing auth code to move lives under `$TT/apps/web/src/`.
- `$TOOLKIT` = `/Users/pkarthikr/Work/Projects/ideas-toolkit` (new local git repo, created in Task 1; Tasks 1-7 happen here, outside the TrackThat worktree).

## Global Constraints

- Package scope `@pkarthikr`; names `@pkarthikr/auth-client`, `@pkarthikr/auth-react`, `@pkarthikr/auth-cdk`; folders `packages/auth/{client,react,cdk}`; `pnpm-workspace.yaml` lists `packages/*/*` and `packages/*`.
- Tooling matches TrackThat's: pnpm `12.11.2`, Node `>=26 <27` (`.nvmrc`), TypeScript `~6.0.3`, ESLint, Prettier, Vitest `^5.0.3`. Copy configs from `$TT` rather than rewriting them.
- Peer dependencies: `aws-amplify` (client), `react` (react), `aws-cdk-lib` and `constructs` (cdk). `auth-client` is a peer dependency of `auth-react` (decision made after the Phase A review, see the spec), and `auth-react` does not depend on `react-router`.
- Styling: plain CSS, no inline `style=` (TrackThat's CSP is `style-src 'self'`). Theme variables, each used as `var(--auth-x, fallback)`: `--auth-brand`, `--auth-brand-tint`, `--auth-ink`, `--auth-muted`, `--auth-border`, `--auth-input-border`, `--auth-disabled-bg`, `--auth-surface`, `--auth-error`, `--auth-radius`, `--auth-radius-card`, `--auth-font`, `--auth-font-display`.
- Cognito settings are unchanged from `infra/lib/auth-stack.ts`: email sign-in (case-insensitive), self sign-up, email auto-verify, password 8+ with lower/upper/digit/symbol, MFA off, account recovery none; public SRP-only client, no OAuth, token revocation on, user-existence errors prevented, 1-hour access and ID tokens.
- Versions start at `0.x`; the first release is `0.1.0`.
- Never create the GitHub repo, publish, deploy, or set repo variables without the owner's go-ahead for that exact step (Gates A and B).
- End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- `AuthProvider` missing: a screen or hook used outside it throws a clear error (Task 4).
- Session loading: `getCurrentUser` rejecting yields signed out, and resolving after unmount does not throw or log (Task 4).
- CSP: no rendered auth element carries a `style` attribute (Task 6).
- Theme safety: every `var(--auth-*)` in `theme.css` has a fallback, so an app that sets no variables still renders (Task 5).
- Publishing: no packed manifest contains a `workspace:` specifier or a `src/` path (Task 7).

## File Structure (`$TOOLKIT`)

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.mjs, .prettierrc.json, .editorconfig, .nvmrc, .gitignore, README.md
.changeset/config.json
.github/workflows/ci.yml, release.yml
scripts/check-pack.mjs
packages/auth/client/  package.json tsconfig.json tsup.config.ts src/{auth,config,messages,validation,index}.ts (+ tests)
packages/auth/cdk/     package.json tsconfig.json tsup.config.ts src/{auth-user-pool,index}.ts (+ test)
packages/auth/react/   package.json tsconfig.json tsup.config.ts vitest.config.ts src/{AuthProvider.tsx,useAuthSession.ts,index.ts,theme.css}
                       src/internal/{useFormSubmit.ts,usePageTitle.ts,TextField.tsx,PasswordField.tsx,Button.tsx,FormCard.tsx}
                       src/screens/{SignIn,Register,Confirm}.tsx   (each with a co-located test)
```

---

## Phase A: build the toolkit

### Task 1: Toolkit repo scaffold

**Files:** Create everything in the root of the File Structure above except `scripts/` and `release.yml`.

**Interfaces:** Produces root scripts `build`, `typecheck`, `lint`, `test` (each `pnpm -r run <name>`), `format`, `format:check`, and `changeset`.

- [ ] **Step 1:** `mkdir -p $TOOLKIT && cd $TOOLKIT && git init -b main`. Copy `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `tsconfig.base.json`, `eslint.config.mjs` from `$TT`. Make `.gitignore` also ignore `dist/`.
- [ ] **Step 2:** Create the root `package.json` (`name: ideas-toolkit`, `private: true`, `packageManager` and `engines` copied from `$TT/package.json`, the same scripts and devDependencies as TrackThat's root plus `@changesets/cli` and `tsup`), and `pnpm-workspace.yaml` (`packages/*/*`, `packages/*`, and `allowBuilds: esbuild: true`).
- [ ] **Step 3:** Create `.github/workflows/ci.yml` as a copy of `$TT/.github/workflows/ci.yml` with job name `Typecheck, lint, test, build` and the last two steps replaced by `pnpm build`. Add a short `README.md` (what the repo is, the package list, how to release).
- [ ] **Step 4:** Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test`. Expected: all exit 0 (no packages yet).
- [ ] **Step 5:** Commit `chore: scaffold the toolkit workspace`.

### Task 2: `@pkarthikr/auth-client`

**Files:** Create `packages/auth/client/{package.json,tsconfig.json,tsup.config.ts,src/index.ts,src/index.test.ts}`. Copy `auth.ts`, `config.ts`, `messages.ts`, `validation.ts` and their four `.test.ts` files from `$TT/apps/web/src/auth/` into `src/`. Modify the copied `config.ts` and `config.test.ts`.

**Interfaces:** Produces from `src/index.ts`: `AuthApi`, `AuthErrorCode`, `AuthFailure`, `authApi`, `AuthConfig`, `readAuthConfig(env: Record<string, string | undefined>): AuthConfig`, `configureAuth(env: Record<string, string | undefined>): void`, `messageFor(code: AuthErrorCode): string`, `PASSWORD_MIN_LENGTH`, `CODE_LENGTH`, `isPlausibleEmail`.

- [ ] **Step 1:** Create `package.json`: `name: @pkarthikr/auth-client`, `version: 0.0.0`, `type: module`, `files: ["dist"]`, `exports: { ".": "./src/index.ts" }`, `publishConfig: { registry: "https://npm.pkg.github.com", access: "restricted", exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } } }`, `peerDependencies: { "aws-amplify": "^6.22.2" }`, matching devDependencies (same versions as `$TT/apps/web`), scripts `build: tsup`, `typecheck`, `lint`, `test` (`vitest run`). `tsconfig.json` extends the base with `types: ["node"]`. `tsup.config.ts`: entry `src/index.ts`, format `esm`, `dts: true`, `clean: true`.
- [ ] **Step 2:** Write the failing test in `src/config.test.ts` (keep the four existing `readAuthConfig` tests; mock `aws-amplify`): `configureAuth passes the pool ids to Amplify.configure` asserts `Amplify.configure` was called with `{ Auth: { Cognito: { userPoolId: "us-east-1_abc", userPoolClientId: "client123" } } }`; `configureAuth throws when a variable is missing` asserts `configureAuth({})` throws `/VITE_USER_POOL_ID/`. Write `src/index.test.ts`: `exports the public API` asserts the sorted export names equal the list under Interfaces (types excluded).
- [ ] **Step 3:** Run `pnpm --filter @pkarthikr/auth-client test`. Expected: FAIL (`configureAuth` default argument / missing `index.ts`).
- [ ] **Step 4:** In `config.ts` change the signature to `configureAuth(env: Env): void` and remove the `import.meta.env` default. Write `src/index.ts` re-exporting the Interfaces list.
- [ ] **Step 5:** Run `pnpm --filter @pkarthikr/auth-client test && pnpm --filter @pkarthikr/auth-client typecheck && pnpm --filter @pkarthikr/auth-client build`. Expected: PASS; `dist/index.js` and `dist/index.d.ts` exist.
- [ ] **Step 6:** Commit `feat(auth-client): move the auth client library from TrackThat`.

### Task 3: `@pkarthikr/auth-cdk`

**Files:** Create `packages/auth/cdk/{package.json,tsconfig.json,tsup.config.ts,src/auth-user-pool.ts,src/index.ts,src/auth-user-pool.test.ts}`. Package setup mirrors Task 2; peer dependencies `aws-cdk-lib ^2.273.0` and `constructs ^10.8.1` (also devDependencies).

**Interfaces:** Produces `class AuthUserPool extends Construct { readonly userPool: UserPool; readonly userPoolClient: UserPoolClient; constructor(scope: Construct, id: string) }`, exported from `src/index.ts`.

- [ ] **Step 1:** Write `auth-user-pool.test.ts` by porting the five property tests in `$TT/infra/lib/auth-stack.test.ts` (sign-in/auto-verify, password and MFA/recovery, SRP-only public client, existence errors, 1-hour tokens) to synthesize `new AuthUserPool(new Stack(new App(), "Test"), "Auth")`. Add `two instances in one stack get separate pools` (`resourceCountIs("AWS::Cognito::UserPool", 2)` and the same for clients) and `exposes the pool and client` (both properties defined).
- [ ] **Step 2:** Run `pnpm --filter @pkarthikr/auth-cdk test`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `AuthUserPool` in `src/auth-user-pool.ts` by moving the `UserPool` and `addClient("WebClient")` definitions from `$TT/infra/lib/auth-stack.ts` into the constructor (no outputs: those stay in the app's stack). Export it from `src/index.ts`.
- [ ] **Step 4:** Run test, typecheck and build as in Task 2. Expected: PASS and a `dist/` bundle.
- [ ] **Step 5:** Commit `feat(auth-cdk): add the AuthUserPool construct`.

### Task 4: `auth-react` scaffold, provider, session and form hooks

**Files:** Create `packages/auth/react/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts}` and `src/{AuthProvider.tsx,useAuthSession.ts}`, `src/internal/{useFormSubmit.ts,usePageTitle.ts}` with tests. Copy `usePageTitle.ts`, its test, and `screens/useFormSubmit.ts` from `$TT/apps/web/src/` (imports now come from `@pkarthikr/auth-client`).

**Interfaces:** Produces:

```ts
type AuthPaths = { signIn: string; register: string; confirm: string };
type AuthLinkProps = { to: string; className?: string; children: ReactNode };
type AuthLinkComponent = ComponentType<AuthLinkProps>;
function AuthProvider(props: {
  auth: AuthApi;
  appName: string;
  paths: AuthPaths;
  LinkComponent?: AuthLinkComponent;
  children: ReactNode;
}): JSX.Element;
function useAuthContext(): {
  auth: AuthApi;
  appName: string;
  paths: AuthPaths;
  Link: AuthLinkComponent;
}; // internal, not exported from index
type AuthSession = { status: "loading" } | { status: "in"; email: string } | { status: "out" };
function useAuthSession(auth: AuthApi): {
  session: AuthSession;
  signedIn(email: string): void;
  signOut(): Promise<void>;
};
```

`useFormSubmit(run, onFailure?)` and `usePageTitle(title)` keep their current signatures.

- [ ] **Step 1:** Create the package as in Task 2 but: `dependencies: { "@pkarthikr/auth-client": "workspace:*" }`, peer `react ^19.3.0`, devDependencies copied from `$TT/apps/web` (react, react-dom, Testing Library, jsdom, `@types/react*`), `tsconfig` with `jsx: react-jsx` and `lib` including DOM, `vitest.config.ts` with `environment: "jsdom"` and a setup file calling `cleanup` after each test, and `tsup` externalizing `react`.
- [ ] **Step 2:** Write the tests. `AuthProvider.test.tsx`: `useAuthContext returns the provided values`; `default Link renders an <a href> with the className`; `a custom LinkComponent is used`; `useAuthContext outside a provider throws "useAuthContext must be used within an AuthProvider"`. `useAuthSession.test.tsx`: loading then `in` with the email; `out` when `getCurrentUser` resolves null; `out` when it rejects; resolving after unmount does not throw or call `console.error`; `signedIn("a@x.com")` sets `in`; `signOut` calls `auth.signOut` then sets `out`; `signOut` rejection leaves the session `in` and rejects. `useFormSubmit.test.tsx`: `ignores a second submit while one is in flight` (run called once); `shows messageFor(code) for an AuthFailure`; `shows the unknown message for any other error`; `onFailure returning true suppresses the error`.
- [ ] **Step 3:** Run `pnpm --filter @pkarthikr/auth-react test`. Expected: FAIL.
- [ ] **Step 4:** Implement the interfaces above. `useAuthSession` keeps the cancelled-flag effect from `$TT/apps/web/src/App.tsx`.
- [ ] **Step 5:** Run test and typecheck. Expected: PASS.
- [ ] **Step 6:** Commit `feat(auth-react): add the provider, session hook and form hooks`.

### Task 5: Internal components and `theme.css`

**Files:** Create `src/internal/{TextField,PasswordField,Button,FormCard}.tsx` with tests and `src/theme.css`. Port from `$TT/apps/web/src/design/` (components, tests, and the `Button.css`, `FormCard.css`, `TextField.css` rules) and `$TT/apps/web/src/screens/AuthScreen.css`.

**Interfaces:** Produces internal (unexported) `TextField` and `PasswordField` (same props as today), `FormCard({ title?, onSubmit, error?, children })`, and `Button(props: ButtonHTMLAttributes<HTMLButtonElement>)` (primary only: the ghost variant and `to` link form are dropped as unused). Class names are prefixed `auth-` (`auth-button`, `auth-form-card`, `auth-text-field`, `auth-screen__*`).

- [ ] **Step 1:** Port the component tests (label/hint/error wiring, show/hide toggle names `Show password`/`Hide password`, `FormCard` alert, `Button` disabled) and add `theme.css has a fallback on every --auth variable` (read the file; assert no match for `/var\(--auth-[\w-]+\)/` and at least one match for `/var\(--auth-[\w-]+,/`) and `theme.css has no url() or data: values`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Port the components with renamed classes. Write `theme.css` as one plain stylesheet with every rule from the four source CSS files translated to `--auth-*` variables with inline fallbacks (neutral defaults, e.g. `--auth-brand` falls back to `#2563eb`; `--auth-radius` to `12px`; `--auth-radius-card` to `20px`). The Confirm icon's stroke color comes from a CSS class, not an inline value.
- [ ] **Step 4:** Add a `build` step that copies `src/theme.css` to `dist/theme.css` and add `"./theme.css"` to both `exports` (src) and `publishConfig.exports` (dist). Run `pnpm --filter @pkarthikr/auth-react test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(auth-react): add the internal form components and theme`.

### Task 6: Screens and public API

**Files:** Create `src/screens/{SignIn,Register,Confirm}.tsx` with tests and `src/index.ts`. Port from `$TT/apps/web/src/screens/` and their tests.

**Interfaces:** Consumes `useAuthContext`, `useFormSubmit`, `usePageTitle`, and the internal components. Produces from `src/index.ts`: `AuthProvider`, `useAuthSession`, `SignIn`, `Register`, `Confirm` and the types `AuthPaths`, `AuthLinkProps`, `AuthLinkComponent`, `AuthSession`.

```ts
function SignIn(props: {
  onSignedIn(email: string): void;
  onNeedsConfirmation(email: string): void;
}): JSX.Element;
function Register(props: { onRegistered(email: string): void }): JSX.Element;
function Confirm(props: { email: string; onConfirmed(): void }): JSX.Element;
```

- [ ] **Step 1:** Port the three screen tests, replacing `MemoryRouter` with an `AuthProvider` (fake `auth`, `appName: "Acme"`, paths `/sign-in`, `/register`, `/confirm`); the assertions (labels, button names, headings, callbacks, error messages) stay as they are. Add: `page titles use appName` (`Acme: Sign in`, `Acme: Create account`, `Acme: Confirm code`); `switch links use the configured paths and LinkComponent`; `Sign in copy reads "New to Acme?"`; and `no rendered element has a style attribute` for each screen.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Port the screens: render only `<main>` content (no `PageShell`), take `auth`, `appName`, `paths` and `Link` from `useAuthContext`, and build titles and copy from `appName`. Write `src/index.ts`, plus `index.test.ts` asserting the sorted runtime export names.
- [ ] **Step 4:** Run `pnpm --filter @pkarthikr/auth-react test && pnpm --filter @pkarthikr/auth-react typecheck && pnpm --filter @pkarthikr/auth-react build`. Expected: PASS; `dist/index.js`, `dist/index.d.ts` and `dist/theme.css` exist.
- [ ] **Step 5:** Commit `feat(auth-react): add the sign-in, register and confirm screens`.

### Task 7: Release setup and pack verification

**Files:** Create `.changeset/config.json`, one changeset file, `.github/workflows/release.yml`, `scripts/check-pack.mjs`; modify root `package.json` (script `check:pack`) and `README.md`.

**Interfaces:** Produces `pnpm check:pack` (exit 0 only if every packed manifest is publishable).

- [ ] **Step 1:** Write `scripts/check-pack.mjs`: for each of the three packages run `pnpm pack`, read the tarball's `package.json`, and fail on: any `workspace:` value; any `exports` target not starting with `./dist/`; a missing `dist/index.js` or `dist/index.d.ts` in the tarball (plus `dist/theme.css` for `auth-react`); a name not starting `@pkarthikr/`. Print `OK` per package.
- [ ] **Step 2:** Run `pnpm build && pnpm check:pack`. Expected: `OK` for all three. If a manifest still shows `src/` or `workspace:`, fix the `publishConfig` before continuing.
- [ ] **Step 3:** Smoke-test the tarballs outside the repo: in a fresh directory under the scratchpad, `pnpm add` the three tarballs plus `react`, `aws-amplify`, `aws-cdk-lib` and `constructs`, then run a Node script that imports each package and checks `AuthUserPool`, `authApi`, `SignIn` and `AuthProvider` are defined. Expected: prints their types without error.
- [ ] **Step 4:** Add `.changeset/config.json` (`access: restricted`, `baseBranch: main`) and one `minor` changeset covering all three packages ("Initial extraction from TrackThat"). Create `release.yml`: `workflow_dispatch`, permissions `contents: read` and `packages: write`, a step that fails unless `github.ref` is `refs/heads/main`, then install, `pnpm build`, `pnpm check:pack`, and `pnpm changeset publish` with `NODE_AUTH_TOKEN` set to `${{ secrets.GITHUB_TOKEN }}`. Document in `README.md`: add a changeset per change, run `pnpm changeset version` in a PR to bump versions, then run the Release workflow.
- [ ] **Step 5:** Run `pnpm changeset version` to bump the packages to `0.1.0`, then `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 6:** Commit `chore: add release workflow and pack verification`.

---

## Gate A: owner go-ahead (stop here)

Show the owner these exact steps and wait for approval of each: (1) `gh repo create pkarthikr/ideas-toolkit --private --source . --push` from `$TOOLKIT`; (2) run the `Release` workflow, which publishes `0.1.0` of the three packages to GitHub Packages; (3) in each package's GitHub settings, grant the `track-that-app` repo read access; (4) for local installs, `gh auth refresh -s read:packages` and add `//npm.pkg.github.com/:_authToken=<token>` to `~/.npmrc`. Tasks 8-9 need the published packages.

## Phase B: migrate TrackThat (in `$TT`)

### Task 8: Web app onto the packages

**Files:** Create root `.npmrc`. Modify `apps/web/package.json`, `apps/web/src/{App.tsx,App.test.tsx,main.tsx}`, `apps/web/src/design/tokens.css`. Delete `apps/web/src/auth/`, `screens/{SignIn,Register,Confirm}.tsx`, their tests, `screens/AuthScreen.css`, `screens/useFormSubmit.ts`, and any `design/` file (with its css and test) whose only importers were the deleted files (check with `grep` before deleting `TextField`, `PasswordField`, `FormCard`, `Button`, `usePageTitle`).

**Interfaces:** Consumes the Task 2-6 exports. Produces no new interfaces.

- [ ] **Step 1:** Create `.npmrc` with `@pkarthikr:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`. Add `@pkarthikr/auth-client` and `@pkarthikr/auth-react` (`^0.1.0`) to `apps/web`; keep `aws-amplify` (the client's peer). Run `pnpm install`.
- [ ] **Step 2:** Update `App.test.tsx` imports (`AuthApi`, `AuthFailure` from `@pkarthikr/auth-client`). The existing `App` tests are the behavior check and must otherwise stay unchanged; they may fail until Step 3 because the local screens still use the old `AuthFailure` class.
- [ ] **Step 3:** Rewrite `App.tsx`: wrap the routes in `AuthProvider` (`appName="Track That"`, paths `/sign-in`, `/register`, `/confirm`, `LinkComponent={Link}` from react-router); replace the session effect with `useAuthSession(auth)`; render each package screen inside TrackThat's `PageShell` (sign-in: action "Create account" to `/register`; register: action "Sign in" to `/sign-in`; confirm: `back` to `/register`); `signOut` navigates to `/sign-in` after the hook's `signOut()` resolves. In `main.tsx` import `@pkarthikr/auth-react/theme.css` before `./design/base.css` and call `configureAuth(import.meta.env)`. In `tokens.css` map every `--auth-*` variable to the matching TrackThat token (`--auth-brand: var(--color-brand)`, `--auth-input-border: var(--color-ghost-border)`, `--auth-disabled-bg: var(--color-empty)`, `--auth-radius: var(--radius-md)`, `--auth-radius-card: var(--radius-xl)`, `--auth-font: var(--font-body)`, `--auth-font-display: var(--font-display)`, and the rest to their obvious counterparts).
- [ ] **Step 4:** Delete the files listed above. Run `pnpm --filter @trackthat/web test && pnpm typecheck && pnpm lint && pnpm --filter @trackthat/web build`. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(web): use the shared auth packages`.

### Task 9: Infra and CI onto the packages

**Files:** Modify `infra/package.json`, `infra/lib/auth-stack.ts`, `.github/workflows/{ci,deploy}.yml`, `README.md`.

- [ ] **Step 1:** Add `@pkarthikr/auth-cdk` (`^0.1.0`) to `infra`. Run `pnpm --filter @trackthat/infra test`; `auth-stack.test.ts` must stay unchanged and, after Step 2, pass as the equivalence check.
- [ ] **Step 2:** In `auth-stack.ts`, create `new AuthUserPool(this, "Auth")` and expose its `userPool` and `userPoolClient` as the stack's existing readonly fields; keep the two `CfnOutput`s.
- [ ] **Step 3:** In both workflows add `packages: read` to `permissions` and `env: NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the install step. Update the README's auth section: auth now lives in `ideas-toolkit`, how to get a local token (Gate A step 4), and the new-pool deploy note below.
- [ ] **Step 4:** Run `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @trackthat/web build && pnpm --filter @trackthat/infra exec cdk synth`. Expected: all PASS; synth produces `TrackThatAuth` with one pool and one client.
- [ ] **Step 5:** Commit `refactor(infra): use the shared AuthUserPool construct`, push the branch, and open a PR (CI check `Typecheck, lint, test, synth` must pass; the CI install needs the package access from Gate A).

---

## Gate B: owner go-ahead (stop here)

After the PR merges: (1) show `cdk diff` output (read-only AWS check) and confirm it replaces the pool and client and leaves the old pool in place; (2) run the `Deploy` workflow (`gh workflow run deploy.yml --ref main`), which deploys the new pool; (3) read the new `UserPoolId` and `UserPoolClientId` from the stack outputs, set the repo variables `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID`, and run `Deploy` again so the web build uses them; (4) run the smoke test from the original auth spec (register, receive code, confirm, sign in, sign out, reload keeps the session); (5) optionally delete the old pool by hand. Each is a separate go-ahead with the exact command shown first.
