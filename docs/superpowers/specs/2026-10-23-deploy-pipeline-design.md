# Deploy Pipeline Design

Date: 2026-10-23
Status: Draft, awaiting review

## Goal

A manually triggered GitHub Actions workflow deploys the existing CDK stacks (`TrackThatApi`, `TrackThatAuth`) to AWS, authenticating through GitHub's OIDC provider with no long-lived credentials.

## Scope

In scope:

- A `GithubOidcStack` in the existing CDK app: the IAM OIDC provider and a deploy role that only the `main` branch of this repository can assume.
- A `deploy.yml` workflow, started by hand, that verifies the code and runs `cdk deploy` for the two existing stacks.
- A README "Deploying" section covering the one-time setup.

Out of scope (deliberately, YAGNI):

- Dev/prod stages, SES email, web hosting, a custom domain.
- Automatic triggers (deploy on merge) and approval environments.
- Deploying the OIDC stack from the pipeline.
- Deploying the web app (it has no hosting yet).

## Decisions

| Decision                  | Choice                                                  | Why                                                                    |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Trigger                   | `workflow_dispatch` only, guarded to `main`             | One environment and no staging, so a deploy should be a deliberate act |
| AWS authentication        | GitHub OIDC role                                        | No long-lived keys to leak or rotate                                   |
| Where the role is defined | `GithubOidcStack` in the CDK app, deployed by hand once | Version-controlled and testable like the rest of the infra             |
| Pipeline permissions      | `sts:AssumeRole` on the CDK bootstrap roles only        | A compromised workflow cannot exceed what CDK's own deploy roles allow |
| Config location           | GitHub repo variables, not secrets                      | The role ARN and region are not sensitive                              |
| OIDC provider             | Created by the stack (assumes none exists yet)          | See "Assumption" below                                                 |

## Infrastructure (`infra`)

A new `GithubOidcStack` (separate from `ApiStack` and `AuthStack`) contains:

- An IAM OIDC provider with URL `https://token.actions.githubusercontent.com` and client id `sts.amazonaws.com`.
- A role named `TrackThatGithubDeploy`. Its trust policy allows `sts:AssumeRoleWithWebIdentity` from that provider only when `token.actions.githubusercontent.com:aud` equals `sts.amazonaws.com` and `token.actions.githubusercontent.com:sub` equals exactly `repo:pkarthikr/track-that-app:ref:refs/heads/main`. No wildcards in the `sub`.
- One inline permission: `sts:AssumeRole` on the CDK bootstrap roles in the same account (`arn:aws:iam::<account>:role/cdk-hnb659fds-*`). Nothing else.
- Maximum session duration of 1 hour.
- Stack output: `DeployRoleArn`.

`bin/app.ts` instantiates it as `GithubOidcStack`. The repository owner and name are constants in the stack file, not configuration.

The stack is not deployed by the pipeline. A person deploys it once with admin credentials, after a one-time `cdk bootstrap` of the account.

### Assumption

The account has no existing IAM OIDC provider for `token.actions.githubusercontent.com` (an account can hold only one per URL). If one exists, the first deploy fails with an "already exists" error; the remedy is to change the stack to import it with `OpenIdConnectProvider.fromOpenIdConnectProviderArn`. This is not built now.

## Workflow (`.github/workflows/deploy.yml`)

- Trigger: `workflow_dispatch` only. The first job step fails unless `github.ref` is `refs/heads/main`.
- Permissions: `id-token: write` and `contents: read`.
- Concurrency: group `deploy`, `cancel-in-progress: false`.
- Steps, in order: checkout; pnpm and Node setup matching `ci.yml` (version from `package.json` and `.nvmrc`, pnpm cache); `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm lint`; `pnpm test`; configure AWS credentials with `aws-actions/configure-aws-credentials` using `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}` and `aws-region: ${{ vars.AWS_REGION }}`; then `pnpm --filter @trackthat/infra exec cdk deploy TrackThatApi TrackThatAuth --require-approval never`.
- No static AWS keys and no secrets.
- Action versions follow `ci.yml`'s existing style of pinning by major version.

`--require-approval never` is acceptable because the manual dispatch from `main` is the approval gate and the role cannot do more than CDK's bootstrap roles.

## Documentation

`README.md` gains a "Deploying" section:

- One-time setup: bootstrap the account, deploy `GithubOidcStack` by hand, set the repo variables `AWS_DEPLOY_ROLE_ARN` (from the `DeployRoleArn` output) and `AWS_REGION`.
- How to run the workflow from the Actions tab.
- The note that only `TrackThatApi` and `TrackThatAuth` deploy, and that there is a single environment.

The existing "do not run `cdk bootstrap` or `cdk deploy` yet" prerequisite is reworded to point at that section.

## Testing

- CDK assertions on `GithubOidcStack` (`aws-cdk-lib/assertions`):
  - the OIDC provider has the GitHub URL and the `sts.amazonaws.com` client id;
  - the role's trust policy pins the exact `aud` and `sub` conditions;
  - the role's only permission is `sts:AssumeRole`, scoped to the bootstrap roles, and there is no `*` action;
  - the max session duration is 3600 seconds;
  - `DeployRoleArn` is output.
- `cdk synth` in CI already covers the new stack offline.
- The workflow cannot be run in automation. The first real run is manual, after the one-time setup, and checks that every step up to the deploy passes, that the OIDC role is assumed, and that `cdk deploy` creates the two stacks.

## Files

New: `infra/lib/github-oidc-stack.ts` and its test, `.github/workflows/deploy.yml`.
Changed: `infra/bin/app.ts`, `README.md`.
