# TrackThat

TrackThat is being rebuilt. For now the repository holds only the public landing page and the AWS infrastructure that hosts it. The app will pivot to an offline-only web app later; the previous API, authentication, and habits code was removed (it is still in git history).

## Folder Layout

```
track-that-app/
├── apps/
│   └── web/              # @trackthat/web: Vite + React landing page (a single bare page at "/")
├── infra/                # @trackthat/infra: AWS CDK app with two stacks (see below)
├── .github/workflows/
│   ├── ci.yml            # PR and main CI: install, typecheck, lint, test, web build, cdk synth
│   └── deploy.yml        # manual deploy via GitHub OIDC
├── tsconfig.base.json    # Shared strict TypeScript settings
├── eslint.config.mjs     # ESLint flat config
└── pnpm-workspace.yaml   # Workspace package globs
```

## Prerequisites

- **Node.js 26**, pinned in `.nvmrc`. Run `nvm use` (or `fnm use`) in the repo root.
- **pnpm 12.11.2**, pinned via the `packageManager` field. Enable it with `corepack enable`.
- AWS credentials are needed only to deploy. Build, test, and `cdk synth` run offline.

## Scripts

Run from the repository root. Each script fans out to every workspace package.

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `pnpm build`        | Builds the web app (Vite) and typechecks infra  |
| `pnpm typecheck`    | Runs `tsc` strict typechecking in every package |
| `pnpm lint`         | Runs ESLint                                     |
| `pnpm test`         | Runs Vitest in every package                    |
| `pnpm format:check` | Verifies formatting with Prettier               |

Run the web app locally with `pnpm --filter @trackthat/web dev`.

## CDK

The CDK app (`infra/bin/app.ts`) has two stacks:

- `TrackThatWeb`: the static site. An S3 bucket (private, encrypted) behind a CloudFront distribution with security headers and an optional custom domain. Its `WebUrl` output is the site address.
- `GithubOidcStack`: the GitHub OIDC provider and the `TrackThatGithubDeploy` role that the deploy workflow assumes. Deployed by hand once per account.

`TrackThatWeb` reads the built app from `apps/web/dist`, so run `pnpm --filter @trackthat/web build` before any `cdk` command. Only the Deploy workflow should publish the site.

### Custom domain

Two optional repository variables control the domain:

- `WEB_CERTIFICATE_ARN`: an ACM certificate ARN in `us-east-1`. Required for a custom domain.
- `WEB_DOMAIN`: the domain to serve. When unset, the site uses the legacy hostname `track-that.pkarthikr.in`. When set, CloudFront serves the apex and `www.`, and `www` redirects to the apex with a 301.

DNS is on Cloudflare, and records pointing at CloudFront must be DNS-only (not proxied). The `DistributionDomainName` output is the CNAME target.

## Deploying

`.github/workflows/deploy.yml` runs typecheck, lint, and test, then deploys `TrackThatWeb` through GitHub OIDC (no stored AWS keys). It refuses to run from any branch but `main`.

One-time setup, done by someone with admin AWS credentials in `us-east-1`:

1. Check that the account has no existing GitHub OIDC provider: `aws iam list-open-id-connect-providers`. An account can hold only one for GitHub's URL.
2. Build the web app, then bootstrap CDK: `pnpm --filter @trackthat/infra exec cdk bootstrap aws://<ACCOUNT_ID>/us-east-1`.
3. Deploy the role stack: `pnpm --filter @trackthat/infra exec cdk deploy GithubOidcStack`. Copy the `DeployRoleArn` output.
4. Set these repository variables (variables, not secrets):
   - `AWS_DEPLOY_ROLE_ARN`: the `DeployRoleArn` value.
   - `AWS_REGION`: `us-east-1`.
   - `WEB_CERTIFICATE_ARN` and `WEB_DOMAIN`, if using a custom domain (see above).

   ```bash
   gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn>"
   gh variable set AWS_REGION --body "us-east-1"
   ```

5. Run the workflow: `gh workflow run deploy.yml --ref main`.

Security note: the deploy role can assume the CDK bootstrap roles, which deploy with administrator-level permissions. Anyone who can push to `main` controls the account, so protect `main` with required reviews and no direct pushes.
