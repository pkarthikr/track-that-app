# TrackThat

TrackThat is a habit tracker. This repository is the monorepo for its web app, API, shared code, and AWS infrastructure. The current state is a hello-world skeleton: every package builds, typechecks, lints, and runs a trivial test, but there are no features, schemas, or deployments yet.

## Folder Layout

```
track-that-app/
├── apps/
│   └── web/              # @trackthat/web: Vite + React frontend (renders "Hello TrackThat")
├── services/
│   └── api/              # @trackthat/api: Lambda handler returning { message: "hello" }
├── packages/
│   ├── shared/           # @trackthat/shared: cross-package constants (APP_NAME)
│   └── core/             # @trackthat/core: domain logic placeholder
├── infra/                # @trackthat/infra: AWS CDK app with an empty ApiStack
├── .github/workflows/
│   └── ci.yml            # PR and main CI: install, typecheck, lint, test, cdk synth
├── tsconfig.base.json    # Shared strict TypeScript settings
├── eslint.config.mjs     # ESLint flat config (applies to every package)
└── pnpm-workspace.yaml   # Workspace package globs
```

Internal packages are consumed as TypeScript source (`exports` points at `src/index.ts`), so there is no separate build step needed before typechecking or testing. The `build` script for `shared`, `core`, and `infra` only typechecks; `web` and `api` produce real artifacts (`apps/web/dist`, `services/api/dist/handler.js`).

## Prerequisites

- **Node.js 22 LTS.** The version is pinned in `.nvmrc` and `engines`. Run `nvm use` (or `fnm use`) in the repo root.
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

## Notes and Decisions

- **Node 22 pin vs. local Node 26.** The project targets Node 22 (`.nvmrc`, `engines`). Node 22 was installed locally via Homebrew for this work.
- **Library packages are source-consumed.** Keeping `shared` and `core` as source avoids build-order problems in `pnpm -r`. If they are ever published, add an emit step.
- **`api` is bundled, not `tsc`-compiled,** because its workspace dependency is TypeScript source. The bundle is CommonJS so the Lambda loads it without extra config.
- **pnpm 12 build scripts.** pnpm blocks dependency install scripts by default. `esbuild` is allowed in `pnpm-workspace.yaml` (`allowBuilds`), since it needs its postinstall step.
- **Typescript is pinned to 6.0.x.** `typescript-eslint` does not yet support TypeScript 7.

## Next Steps

- Add the first real feature to `packages/core` with tests.
- Add a database schema and API routes in `services/api`.
- Add a deploy pipeline once the stack has resources.

## License

TBD.
