# Email and Password Auth Design

Date: 2026-10-23
Status: Draft, awaiting review

## Goal

A user can register with an email and password, confirm their email with an emailed code, and sign in to the TrackThat web app. Authentication is backed by Amazon Cognito.

## Scope

In scope:

- A Cognito user pool and a public app client, defined in the CDK app (`infra`).
- Register, confirm, sign-in, and sign-out screens in `apps/web`, built as custom forms using the Amplify auth library.
- A minimal signed-in view showing the user's email and a sign-out button.

Out of scope (deliberately, YAGNI):

- Password reset, resend-code, MFA, social or SAML login, user profile.
- Protecting API routes (the API stays open; it only returns hello).
- A router library, deployment, and a domain for Cognito managed login.

## Decisions

| Decision           | Choice                                                 | Why                                                                  |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Auth UI            | Custom React forms                                     | Keeps users in the app and the UI under our control                  |
| Client library     | `aws-amplify/auth` (Amplify JS v6, auth category only) | Handles SRP, token storage, and refresh; no Amplify backend required |
| Email verification | Required, emailed code                                 | Proves ownership of the address; no extra Lambda trigger needed      |
| API protection     | None this iteration                                    | Only a hello endpoint exists and nothing is deployed                 |
| Token storage      | Amplify default (`localStorage`)                       | See "Token storage" below                                            |

## Infrastructure (`infra`)

A new `AuthStack` (separate from `ApiStack`) contains:

- `UserPool`: sign-in alias is email only, self sign-up enabled, `autoVerify: { email: true }`, password minimum length 8 with Cognito's default character requirements, MFA off, account recovery disabled (no reset flow yet).
- `UserPoolClient`: public client with no secret (`generateSecret: false`), only `userSrp` auth flow enabled, token revocation enabled, short access and ID token lifetimes (1 hour or less).
- Stack outputs: `UserPoolId` and `UserPoolClientId`.

`bin/app.ts` instantiates `AuthStack`. Nothing is deployed; CI continues to run `cdk synth` only.

## Web app (`apps/web`)

### Configuration

`src/auth/config.ts` reads `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, and `VITE_AWS_REGION` from `import.meta.env`, throws a clear error naming any missing variable, and configures Amplify. A `.env.example` documents the variables. Real values come from the deployed stack outputs and are never committed.

### Auth wrapper

`src/auth/auth.ts` wraps Amplify behind a small interface so components never import Amplify directly:

- `signUp(email, password)`
- `confirmSignUp(email, code)`
- `signIn(email, password)`
- `signOut()`
- `getCurrentUser()` returns the signed-in user's email, or `null`

The wrapper maps Cognito exceptions to a small set of typed errors (user exists, invalid credentials, user not confirmed, bad or expired code, invalid password, unknown) so the UI can show readable messages.

### Screens

`App` switches between views using state; there is no router. Views:

1. Register: email and password, then goes to Confirm.
2. Confirm: 6-digit code, then goes to Sign in.
3. Sign in: email and password. If Cognito reports the user is not confirmed, go to Confirm for that email.
4. Signed in: shows the user's email and a sign-out button.

On load the app calls `getCurrentUser()` to restore an existing session.

### Token storage

Amplify's default `localStorage` storage is kept. Tokens are readable by injected script, so the mitigations are token revocation on the app client and short access token lifetimes. Switching to cookie storage is deferred until there is a deployed domain and a reason to; it is a small change confined to `auth/config.ts`.

## Testing

- Auth wrapper: unit tests with Amplify mocked, covering each function and each error mapping.
- Screens: Testing Library tests for each screen's happy path and its main error path, using a fake auth wrapper.
- CDK: assertion tests on the synthesized template (`aws-cdk-lib/assertions`) checking that the client has no secret, only SRP auth is enabled, email is auto-verified, and sign-in is by email.
- No automated test talks to live Cognito. A manual smoke-test checklist (register, receive code, confirm, sign in, sign out, reload keeps the session) is run once after the first deploy.

CI is unchanged: typecheck, lint, test, and `cdk synth` already cover the new code.

## Files

New: `infra/lib/auth-stack.ts` and its test, `apps/web/src/auth/{config,auth}.ts` and tests, one component per screen under `apps/web/src/`, and `apps/web/.env.example`.
Changed: `infra/bin/app.ts`, `apps/web/src/App.tsx` and its test, `apps/web/package.json` (add `aws-amplify`), and the README (new env vars and the auth overview).
