# TrackThat

TrackThat is a habit tracker. This repository is the monorepo for its web app, API, shared code, and AWS infrastructure. The current state is a skeleton: every package builds, typechecks, lints, and runs tests. The only feature is email and password sign-up and sign-in, backed by a Cognito user pool defined in CDK. Nothing is deployed yet, and there are no schemas.

## Folder Layout

```
track-that-app/
├── apps/
│   └── web/              # @trackthat/web: Vite + React frontend (auth screens: register, confirm, sign in)
├── services/
│   └── api/              # @trackthat/api: Lambda handler returning { message: "hello" }
├── packages/
│   ├── shared/           # @trackthat/shared: cross-package constants (APP_NAME)
│   └── core/             # @trackthat/core: domain logic placeholder
├── infra/                # @trackthat/infra: AWS CDK app with an empty ApiStack, a Cognito AuthStack, and a GithubOidcStack (deploy role)
├── .github/workflows/
│   ├── ci.yml            # PR and main CI: install, typecheck, lint, test, cdk synth
│   └── deploy.yml        # manual deploy via GitHub OIDC
├── tsconfig.base.json    # Shared strict TypeScript settings
├── eslint.config.mjs     # ESLint flat config (applies to every package)
└── pnpm-workspace.yaml   # Workspace package globs
```

Internal packages are consumed as TypeScript source (`exports` points at `src/index.ts`), so there is no separate build step needed before typechecking or testing. The `build` script for `shared`, `core`, and `infra` only typechecks; `web` and `api` produce real artifacts (`apps/web/dist`, `services/api/dist/handler.js`).

## Prerequisites

- **Node.js 26.** The version is pinned in `.nvmrc` and `engines`. Run `nvm use` (or `fnm use`) in the repo root.
- **pnpm 12.11.2.** Pinned via the `packageManager` field. Enable it with `corepack enable`, or install it with `npm i -g pnpm@12.11.2`.
- **AWS credentials are not needed to build, test, or `cdk synth`.** `cdk synth` works offline. They are needed only to deploy; see [Deploying](#deploying).

## Getting Started

```bash
pnpm install
```

## Scripts

Run from the repository root. Each script fans out to every workspace package with `pnpm -r`.

| Command             | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `pnpm build`        | Builds `web` (Vite) and `api` (esbuild bundle); typechecks the other packages |
| `pnpm typecheck`    | Runs `tsc` strict typechecking in every package                               |
| `pnpm lint`         | Runs ESLint (flat config, typescript-eslint, Prettier-compatible)             |
| `pnpm test`         | Runs Vitest in every package (`web` uses jsdom and Testing Library)           |
| `pnpm format`       | Formats the whole repo with Prettier                                          |
| `pnpm format:check` | Verifies formatting without writing changes (used for review)                 |

Package-level scripts can be run with a filter, for example:

```bash
pnpm --filter @trackthat/web dev                    # start the Vite dev server
pnpm --filter @trackthat/api build                  # bundle the Lambda to services/api/dist/handler.js
pnpm --filter @trackthat/infra exec cdk synth       # synthesize CloudFormation (no AWS calls)
```

## CI

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`. It installs with `pnpm install --frozen-lockfile`, then runs `typecheck`, `lint`, `test`, and `cdk synth`. It does not deploy; see [Deploying](#deploying).

## Deploying

`.github/workflows/deploy.yml` deploys the CDK stacks from GitHub Actions, authenticating to AWS through GitHub's OIDC provider (no stored AWS keys). There is a single environment, with no dev/prod separation yet. Only `TrackThatApi` and `TrackThatAuth` are deployed. The web app is not deployed, since there is no hosting yet.

One-time setup, done by a person with admin AWS credentials (the workflow does not do this):

1. Check that the account has no existing GitHub OIDC provider: `aws iam list-open-id-connect-providers`. `GithubOidcStack` creates one, and an account can hold only one for GitHub's URL, so an existing provider makes the first deploy of `GithubOidcStack` fail.
2. Bootstrap CDK: `pnpm --filter @trackthat/infra exec cdk bootstrap aws://<ACCOUNT_ID>/<REGION>`.
3. Deploy the role stack by hand: `pnpm --filter @trackthat/infra exec cdk deploy GithubOidcStack`. Copy the `DeployRoleArn` stack output.
4. Set two repository variables (variables, not secrets), with `gh variable set` or under Settings → Secrets and variables → Actions → Variables:
   - `AWS_DEPLOY_ROLE_ARN`: the `DeployRoleArn` value.
   - `AWS_REGION`: the region you bootstrapped.

Use the same AWS account and region throughout: the bootstrap, the `GithubOidcStack` deploy, the `AWS_REGION` variable, and every later workflow run. Deploying to a region that was not bootstrapped fails.

Security note: the deploy role is effectively administrative, because it can assume the CDK bootstrap roles, and those deploy CloudFormation with an administrator-level execution role. Anyone who can push to `main` or merge a pull request controls what that role does. Turn on branch protection for `main` (pull request and review required, no direct pushes, no force-pushes) before the first deploy. The trust policy only accepts workflows running on `main`, so that protection is what guards the account.

To deploy, open the Actions tab, choose Deploy, and Run workflow on `main`, or run `gh workflow run deploy.yml --ref main`. The workflow runs typecheck, lint, and test before it touches AWS. It refuses to run from any branch other than `main`, and the deploy role's trust policy only accepts `main` as well.

## Authentication

Sign-up and sign-in use an Amazon Cognito user pool, defined in `infra/lib/auth-stack.ts` (`AuthStack`, instantiated as `TrackThatAuth` in `infra/bin/app.ts`). New users register with an email and password, then must confirm the address with a 6-digit code sent by email. Resend-code does not exist yet, so an expired code currently blocks that email address from being confirmed through the UI.

See [Deploying](#deploying) for the first deploy. After it, the web app is configured like this:

1. Copy `apps/web/.env.example` to `apps/web/.env.local`.
2. Set `VITE_USER_POOL_ID` to the `UserPoolId` stack output and `VITE_USER_POOL_CLIENT_ID` to the `UserPoolClientId` stack output.

Manual smoke test: register, receive the code by email, confirm, sign in, sign out, then sign in again and reload the page to check that the session is kept.

## Notes and Decisions

- **Node 26 for development.** `.nvmrc`, `engines`, and CI all use Node 26. The Lambda bundle still targets `node22` (esbuild `--target`) to match the AWS Lambda runtime; change it once a Node 26 runtime is available there.
- **Library packages are source-consumed.** Keeping `shared` and `core` as source avoids build-order problems in `pnpm -r`. If they are ever published, add an emit step.
- **`api` is bundled, not `tsc`-compiled,** because its workspace dependency is TypeScript source. The bundle is CommonJS so the Lambda loads it without extra config.
- **pnpm 12 build scripts.** pnpm blocks dependency install scripts by default. `esbuild` is allowed in `pnpm-workspace.yaml` (`allowBuilds`), since it needs its postinstall step.
- **Typescript is pinned to 6.0.x.** `typescript-eslint` does not yet support TypeScript 7.

## Next Steps

- Add the first real feature to `packages/core` with tests.
- Add a database schema and API routes in `services/api`.
- Run the first deploy (see [Deploying](#deploying)).
- Add dev and prod stages.
- Add SES email for the user pool.
- Add web hosting.
- Add resend confirmation code.
- Add password reset.
- Protect API routes with the Cognito user pool.

## License

TBD.
