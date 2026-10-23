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
├── infra/                # @trackthat/infra: AWS CDK app with an empty ApiStack and a Cognito AuthStack
├── .github/workflows/
│   └── ci.yml            # PR and main CI: install, typecheck, lint, test, cdk synth
├── tsconfig.base.json    # Shared strict TypeScript settings
├── eslint.config.mjs     # ESLint flat config (applies to every package)
└── pnpm-workspace.yaml   # Workspace package globs
```

Internal packages are consumed as TypeScript source (`exports` points at `src/index.ts`), so there is no separate build step needed before typechecking or testing. The `build` script for `shared`, `core`, and `infra` only typechecks; `web` and `api` produce real artifacts (`apps/web/dist`, `services/api/dist/handler.js`).

## Prerequisites

- **Node.js 26.** The version is pinned in `.nvmrc` and `engines`. Run `nvm use` (or `fnm use`) in the repo root.
- **pnpm 12.11.2.** Pinned via the `packageManager` field. Enable it with `corepack enable`, or install it with `npm i -g pnpm@12.11.2`.
- **AWS credentials are not required.** `cdk synth` works offline. Do not run `cdk bootstrap` or `cdk deploy` yet; deployment is out of scope for this skeleton.

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

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`. It installs with `pnpm install --frozen-lockfile`, then runs `typecheck`, `lint`, `test`, and `cdk synth`. There is no deploy job.

## Authentication

Sign-up and sign-in use an Amazon Cognito user pool, defined in `infra/lib/auth-stack.ts` (`AuthStack`, instantiated as `TrackThatAuth` in `infra/bin/app.ts`). New users register with an email and password, then must confirm the address with a 6-digit code sent by email. Resend-code does not exist yet, so an expired code currently blocks that email address from being confirmed through the UI.

Nothing is deployed yet, so the first `cdk deploy` is a future step. After it, the web app is configured like this:

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
- Add a deploy pipeline and do the first deploy of the stacks.
- Add resend confirmation code.
- Add password reset.
- Protect API routes with the Cognito user pool.

## License

TBD.
