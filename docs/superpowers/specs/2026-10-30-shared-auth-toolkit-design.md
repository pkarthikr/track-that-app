# Shared Auth Toolkit Design

Date: 2026-10-30
Status: Draft, awaiting review

## Goal

Auth is built once and reused across the owner's apps instead of being rebuilt per project. It stays the owner's own system (Cognito in their own AWS accounts, their own code), not a third-party service. Success means a new React + CDK app adds auth with little work, and a fix to auth reaches every app by upgrading a version.

The shared code lives in a new repo, `pkarthikr/ideas-toolkit`, a general monorepo for the owner's reusable utilities. Auth is its first set of packages. TrackThat is the first consumer and the proof that the extraction preserved behavior.

## Decisions

| Decision         | Choice                                                                 | Why                                                                                |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| User isolation   | Separate Cognito pool per app, created from the shared construct       | Simplest; one app's outage or breach cannot touch another. SSO is not needed today |
| Layers extracted | Client library, React screens, CDK construct                           | Future apps are React web on AWS CDK, like TrackThat                               |
| Distribution     | Private packages on GitHub Packages, scope `@pkarthikr`                | Versioned, deliberate upgrades; GitHub Packages requires the scope to match owner  |
| Screen styling   | Package ships its own components, themed with `--auth-*` CSS variables | Fast to adopt, consistent across apps; a headless layer can be split out later     |
| Feature scope    | Today's behavior only (register, confirm, sign in, sign out)           | Makes the TrackThat migration a pure refactor; reset and resend-code come later    |
| Repo shape       | One monorepo, packages versioned independently with Changesets         | A new utility never forces a version bump on the auth packages                     |
| Existing users   | TrackThat's current user pool and its users may be discarded           | The owner confirmed there are no users worth keeping                               |

## Out of scope (deliberately, YAGNI)

- Password reset, resend-code, MFA, social or SAML login, and a shared pool or SSO across apps.
- A headless (bring-your-own-components) layer for the screens.
- Moving TrackThat's design components, hosting stacks or other non-auth code into the toolkit. The repo is open to them later, each as its own package.
- Creating the repo, publishing packages, deploying TrackThat, or changing repo variables. Each is a real-resource step and needs the owner's go-ahead for that exact step.

## Repo layout

```
ideas-toolkit/
├── package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint and prettier config
├── .changeset/
├── .github/workflows/
│   ├── ci.yml          typecheck, lint, test, synth on pull requests
│   └── release.yml     manual (workflow_dispatch): changeset publish to GitHub Packages
└── packages/
    └── auth/
        ├── client/     @pkarthikr/auth-client
        ├── react/      @pkarthikr/auth-react
        └── cdk/        @pkarthikr/auth-cdk
```

Packages are grouped by area: a folder per area under `packages/`, with the area prefix dropped from the folder names because the parent already carries it (a future `packages/notifications/client/` would publish as `@pkarthikr/notifications-client`). Folders only organize the repo; published package names are unchanged. `pnpm-workspace.yaml` lists both `packages/*/*` and `packages/*`, so a standalone utility with no group can sit directly under `packages/`. An area folder is created only once it has more than one related package; until then a package sits directly under `packages/`.

Tooling (pnpm, TypeScript, ESLint, Prettier, Vitest, Node version) matches TrackThat's so code moves without rewrites. Versions start at `0.x` and move to `1.0.0` once TrackThat runs on them.

## Packages

### `@pkarthikr/auth-client`

Moved from `apps/web/src/auth/` with its tests: the `AuthApi` interface, `authApi` (Amplify implementation), `AuthFailure` and `AuthErrorCode`, `configureAuth` and `readAuthConfig`, `messageFor`, and the validation helpers. No UI. `aws-amplify` is a peer dependency. Behavior is unchanged, including mapping unknown-user and wrong-password to the same `invalid-credentials` code. One deliberate API change: `configureAuth(env)` takes the env record as a required argument instead of defaulting to `import.meta.env`, because compiled library code cannot rely on the consumer's bundler to substitute `import.meta.env`. The app passes `import.meta.env` itself.

### `@pkarthikr/auth-react`

`auth-client` and `react` are peer dependencies of this package (the app installs `auth-client` itself, and needs it for `configureAuth` and `authApi` anyway). A peer, not a pinned dependency, so the app and the screens share one copy of `auth-client`: a second copy would break the `instanceof AuthFailure` check in the form handling. As a safety net the form hook also accepts an error named `AuthFailure` with a string `code`. It does not depend on `react-router`.

Exports:

- `AuthProvider`: takes `auth` (an `AuthApi`), `appName`, `paths` (`signIn`, `register`, `confirm`) and an optional `LinkComponent`. The default link renders a plain `<a href>`; TrackThat passes react-router's `Link`.
- `SignIn`, `Register`, `Confirm`: the same props and callbacks as today (`onSignedIn`, `onNeedsConfirmation`, `onRegistered`, `onConfirmed`; `Confirm` also takes `email`). They render only the main content (intro, form card, switch link). Page chrome such as the wordmark header and back link stays in the app, which wraps the screens in its own shell. Page titles and the "New to {appName}?" copy use `appName`.
- `useAuthSession(auth)`: loads the current user on mount, tracks `loading | in | out`, and exposes `signOut` and a way to mark the session signed in. This is the session logic currently in `App.tsx`. Route guards and redirects stay in the app because they depend on its routes. This hook is the one addition beyond a straight extraction.

Internals (not exported): `useFormSubmit`, `usePageTitle`, `TextField`, `PasswordField`, `Button` and `FormCard`, with `auth-` class names so they cannot collide with an app's styles.

Theming: one plain stylesheet, `theme.css`, shipped by the package and imported by the app. It reads `--auth-brand`, `--auth-brand-tint`, `--auth-ink`, `--auth-muted`, `--auth-border`, `--auth-input-border`, `--auth-disabled-bg`, `--auth-surface`, `--auth-error`, `--auth-radius`, `--auth-radius-card`, `--auth-font` and `--auth-font-display`, each with a neutral fallback written inline as `var(--auth-x, fallback)`. Fonts are not shipped; the screens inherit the app's. TrackThat maps the variables once (for example `--auth-brand: var(--color-brand)`). The stylesheet is plain CSS with no inline `style=`, because TrackThat's CSP is `style-src 'self'`; the Confirm icon's stroke color comes from a CSS class, not an inline value.

### `@pkarthikr/auth-cdk`

`AuthUserPool` is a construct that wraps the Cognito resources defined today in `infra/lib/auth-stack.ts`: email sign-in (case-insensitive), self sign-up, email auto-verify, password policy of 8+ characters with all four character classes, MFA off, account recovery none, and a public client with no secret, SRP only, no OAuth, token revocation, user-existence errors prevented, and 1-hour access and ID tokens. It exposes `userPool` and `userPoolClient`. `aws-cdk-lib` and `constructs` are peer dependencies. The default removal policy (retain) is kept.

## TrackThat migration

A separate PR in this repo after the packages are published:

- Add `.npmrc` mapping `@pkarthikr` to `https://npm.pkg.github.com`, and depend on the three packages.
- Replace `apps/web/src/auth/*`, the three screens, `useFormSubmit` and the now-unused form components with imports from the packages. Wrap the screens in TrackThat's existing `PageShell`, pass `appName="Track That"`, the route paths and react-router's `Link` to `AuthProvider`, use `useAuthSession` in `App.tsx`, and map the `--auth-*` variables in TrackThat's tokens.
- Replace `AuthStack`'s inline resources with `AuthUserPool`.
- Keep the CI and deploy workflows working: they need read access to the private packages. The preferred route is granting the TrackThat repo access to each package in GitHub's package settings so the built-in `GITHUB_TOKEN` works; a personal access token is the fallback.

The existing TrackThat tests for the screens and `App` should pass with only import changes. That is the check that the extraction preserved behavior.

### Deploy consequence

`AuthUserPool` is a new construct path, so the first deploy creates a new user pool and client with new ids and leaves the old pool in place (retain). This is accepted: the old users are discarded. After that deploy, the repo variables `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID` must be updated to the new ids and the web app redeployed, and the old pool can be deleted by hand. Before deploying, `cdk diff` is reviewed and the exact commands are shown to the owner; none of this runs without their go-ahead for that step.

## Build and publishing

Each package is built with `tsup` into an ES module bundle plus type declarations in `dist/` (`auth-react` also copies `theme.css` there); TrackThat's `infra` runs through `tsx` and the web app through Vite, so both consume the bundles. In the monorepo each package's `exports` point at `src/` so packages and tests resolve each other without a build; `publishConfig.exports` overrides them to `dist/` at publish time. A check script packs every package and fails if a published manifest still contains a `workspace:` specifier or a `src/` path. Each package sets `repository` (with its `directory`) to `pkarthikr/ideas-toolkit`, because GitHub Packages links a package to the repo named there and the check script verifies it. Consumers need `packages: read` permission in their workflows to install from GitHub Packages.

## Releases

`release.yml` is manual, like TrackThat's Deploy workflow. Each change that affects a package ships with a changeset; running the workflow versions the packages and publishes the changed ones to GitHub Packages using the built-in token. Apps upgrade by bumping the version and reading the changelog.

## Testing

- `auth-client`: the existing unit tests move over, with Amplify mocked.
- `auth-react`: Testing Library tests per screen (happy path and main error path) using a fake `AuthApi`, plus tests for `useAuthSession` and for `AuthProvider` defaults (plain `<a>` links, `appName` in titles).
- `auth-cdk`: assertion tests on the synthesized template, checking the same properties as today's `auth-stack.test.ts`.
- No automated test talks to live Cognito. After TrackThat is migrated and deployed, the manual smoke test from the original auth spec is run once: register, receive code, confirm, sign in, sign out, reload keeps the session.

## Order of work

1. Build `ideas-toolkit` locally from the moved code and tests (the repo is created on GitHub only with the owner's go-ahead).
2. Publish the first versions (owner's go-ahead).
3. Migrate TrackThat in its own PR.
4. Deploy and run the smoke test (owner's go-ahead for each real-resource step).
