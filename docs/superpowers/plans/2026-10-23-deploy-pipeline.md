# Deploy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manually triggered GitHub Actions workflow deploys the existing CDK stacks (`TrackThatApi`, `TrackThatAuth`) to AWS through GitHub's OIDC provider, with no long-lived credentials.

**Architecture:** A new `GithubOidcStack` in the CDK app defines the IAM OIDC provider and a deploy role that only `main` of this repository can assume, whose sole permission is assuming the CDK bootstrap roles. A `deploy.yml` workflow (dispatch only) verifies the code, assumes that role, and runs `cdk deploy` for the two named stacks. A person deploys the OIDC stack once by hand.

**Tech Stack:** AWS CDK (`aws-cdk-lib`), IAM OIDC, GitHub Actions, `aws-actions/configure-aws-credentials`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-deploy-pipeline-design.md`

## Global Constraints

- OIDC provider URL is `https://token.actions.githubusercontent.com` with client id `sts.amazonaws.com`.
- Role name is `TrackThatGithubDeploy`. Trust conditions: `token.actions.githubusercontent.com:aud` equals `sts.amazonaws.com`, and `token.actions.githubusercontent.com:sub` equals exactly `repo:pkarthikr/track-that-app:ref:refs/heads/main`. No wildcards in the `sub`.
- The role's only permission is `sts:AssumeRole` on `arn:aws:iam::<account>:role/cdk-hnb659fds-*` (same account). Maximum session duration is 1 hour (3600 seconds). Stack output is named `DeployRoleArn`.
- The pipeline never deploys `GithubOidcStack`; it deploys exactly `TrackThatApi` and `TrackThatAuth`.
- Workflow trigger is `workflow_dispatch` only. Permissions are `id-token: write` and `contents: read`. Concurrency group is `deploy` with `cancel-in-progress: false`. No static AWS keys and no secrets: the role ARN and region come from repo variables `AWS_DEPLOY_ROLE_ARN` and `AWS_REGION`.
- `cdk deploy ... --require-approval never` is used; the manual dispatch from `main` is the approval gate.
- Action versions are pinned by major version, matching `ci.yml` (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`).
- Out of scope: stages, SES, web hosting, automatic triggers, approval environments, importing an existing OIDC provider.
- Match existing style: double quotes, semicolons, `import type` for types (`verbatimModuleSyntax`), tests co-located as `*.test.ts`, explicit Vitest imports. Run `pnpm format` before each commit.
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A token from any ref other than `main` (a PR branch, a fork, a tag) must not be able to assume the role: the trust `sub` is an exact string with no wildcard. Pinned in Task 1.
- A compromised workflow must not gain more than CDK's own bootstrap roles allow: no `*` action and no resource outside the bootstrap-role pattern. Pinned in Task 1.
- Dispatching the workflow from a branch other than `main` must fail before any AWS call, as well as being refused by the trust policy. Pinned in Task 2 (guard step is first).
- A failing typecheck, lint, or test must stop the run before AWS credentials are requested. Pinned in Task 2 (step order).
- A second dispatch while a deploy is running must queue rather than cancel the running CloudFormation update. Pinned in Task 2 (`cancel-in-progress: false`).

---

### Task 1: `GithubOidcStack`

**Files:**

- Create: `infra/lib/github-oidc-stack.ts`
- Create: `infra/lib/github-oidc-stack.test.ts`
- Modify: `infra/bin/app.ts`

**Interfaces:**

- Produces: `export class GithubOidcStack extends Stack` (constructor `(scope: Construct, id: string, props?: StackProps)`) exposing `readonly deployRole: Role`. Module constants `GITHUB_REPO = "pkarthikr/track-that-app"` and `DEPLOY_BRANCH = "main"` (not exported).

- [ ] **Step 1: Write the failing tests** in `github-oidc-stack.test.ts`, with `const template = Template.fromStack(new GithubOidcStack(new App(), "TestOidc"))` as in `auth-stack.test.ts`. Tests:
  - `"registers GitHub's OIDC provider"`: `AWS::IAM::OIDCProvider` has `Url: "https://token.actions.githubusercontent.com"` and `ClientIdList: ["sts.amazonaws.com"]`.
  - `"only main of this repo can assume the role"`: `AWS::IAM::Role` has `RoleName: "TrackThatGithubDeploy"` and an `AssumeRolePolicyDocument` with exactly one statement: `Effect: "Allow"`, `Action: "sts:AssumeRoleWithWebIdentity"`, and `Condition.StringEquals` equal to `{ "token.actions.githubusercontent.com:aud": "sts.amazonaws.com", "token.actions.githubusercontent.com:sub": "repo:pkarthikr/track-that-app:ref:refs/heads/main" }` (exact object, no `StringLike`).
  - `"limits sessions to 1 hour"`: the role has `MaxSessionDuration: 3600`.
  - `"may only assume the CDK bootstrap roles"`: collect every statement from `template.findResources("AWS::IAM::Policy")`; assert there is exactly one statement, its `Action` is `"sts:AssumeRole"`, and `JSON.stringify` of its `Resource` contains `role/cdk-hnb659fds-*`.
  - `"grants no wildcard actions"`: across all `AWS::IAM::Policy` statements, no action equals `"*"` or ends with `":*"`.
  - `"outputs the role ARN"`: `template.hasOutput("DeployRoleArn", {})`.
- [ ] **Step 2: Run** `pnpm --filter @trackthat/infra test`. Expected: FAIL, cannot resolve `./github-oidc-stack`.
- [ ] **Step 3: Implement `GithubOidcStack` in `infra/lib/github-oidc-stack.ts`.** Use the L1 `CfnOIDCProvider` (`aws-cdk-lib/aws-iam`) for the provider rather than the L2 `OpenIdConnectProvider`, which creates a Lambda-backed custom resource; the L1 keeps the template free of that Lambda. If `ThumbprintList` turns out to be required by the synthesized/validated resource, supply GitHub's current published thumbprint and note it in the report. The role is `new Role` with `roleName: "TrackThatGithubDeploy"`, `assumedBy: new WebIdentityPrincipal(provider.attrArn, { StringEquals: {...} })` with the two conditions from the Global Constraints, `maxSessionDuration: Duration.hours(1)`, and a single `addToPolicy` statement (`sts:AssumeRole` on `` `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-*` ``). Build the `sub` string from the two constants. Add a `CfnOutput` named `DeployRoleArn`. Keep the stack environment-agnostic (no `env` prop).
- [ ] **Step 4: Instantiate it in `infra/bin/app.ts`** as `new GithubOidcStack(app, "GithubOidcStack")`, after the existing stacks.
- [ ] **Step 5: Verify.** Run `pnpm --filter @trackthat/infra test`, `... typecheck`, `... lint`, and `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass; synth lists `GithubOidcStack` alongside `TrackThatApi` and `TrackThatAuth` with no AWS calls and no Lambda asset.
- [ ] **Step 6: Commit** `feat(infra): add GitHub OIDC deploy role stack`.

---

### Task 2: Deploy workflow

**Files:**

- Create: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: repo variables `AWS_DEPLOY_ROLE_ARN` (the `DeployRoleArn` output from Task 1) and `AWS_REGION`, which Task 3 documents.
- Produces: a workflow named `Deploy`, dispatch only.

- [ ] **Step 1: Write `deploy.yml`** modelled on `.github/workflows/ci.yml` (same checkout, pnpm, Node, and install steps and the same action versions). Structure:
  - `name: Deploy`; `on: workflow_dispatch`; top-level `permissions: { id-token: write, contents: read }`; `concurrency: { group: deploy, cancel-in-progress: false }`.
  - One job `deploy` on `ubuntu-latest` with these steps in this order:
    1. A guard step that exits non-zero with a clear message unless `github.ref` is `refs/heads/main` (an explicit first step, not a job-level `if`, so a wrong-branch dispatch shows as a failed run rather than a silent skip).
    2. `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7` (with `node-version-file: .nvmrc` and `cache: pnpm`), `pnpm install --frozen-lockfile`.
    3. `pnpm typecheck`, `pnpm lint`, `pnpm test`.
    4. `aws-actions/configure-aws-credentials` at its latest major version (check its releases page; pin by major like the other actions) with `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}` and `aws-region: ${{ vars.AWS_REGION }}`.
    5. `pnpm --filter @trackthat/infra exec cdk deploy TrackThatApi TrackThatAuth --require-approval never`.
- [ ] **Step 2: Verify.** Run `pnpm format:check` (Prettier checks YAML). Then re-read the file against the Global Constraints and the Review Focus items and confirm each: guard is step 1, verification steps precede the credentials step, `cancel-in-progress` is `false`, no `secrets.` references, and `GithubOidcStack` is not in the deploy command. If `actionlint` is installed locally, run it on the file; do not add it as a dependency.
- [ ] **Step 3: Commit** `feat(ci): add manual deploy workflow`.

---

### Task 3: README and full verification

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update `README.md`.**
  - Folder Layout: the `infra` line mentions the `GithubOidcStack` as well, and the `.github/workflows/` block lists `deploy.yml  # manual deploy via GitHub OIDC` beside `ci.yml`.
  - Prerequisites: reword the AWS bullet: credentials are not needed to build, test, or `cdk synth`; they are needed only to deploy, see Deploying.
  - CI: replace "There is no deploy job." with a pointer to the Deploying section.
  - Add a "Deploying" section after CI. Contents: a note that there is one environment and only `TrackThatApi` and `TrackThatAuth` deploy; the one-time setup as numbered steps (check no existing GitHub OIDC provider with `aws iam list-open-id-connect-providers`; `cdk bootstrap aws://<ACCOUNT_ID>/<REGION>`; `cdk deploy GithubOidcStack` by hand with admin credentials and copy `DeployRoleArn`; set repo variables `AWS_DEPLOY_ROLE_ARN` and `AWS_REGION` with `gh variable set` or the Settings page); how to run the workflow (Actions tab, or `gh workflow run deploy.yml --ref main`); and that it can only run from `main`.
  - Authentication: replace "Nothing is deployed yet, so the first `cdk deploy` is a future step. After it, ..." with wording that points to the Deploying section for the first deploy and then keeps the two-step `.env.local` instructions.
  - Next Steps: replace "Add a deploy pipeline and do the first deploy of the stacks." with "Run the first deploy (see Deploying)." and add: dev/prod stages, SES email for the user pool, web hosting.
  - Leave the intro sentence "Nothing is deployed yet" unchanged; it stays true until the first deploy.
- [ ] **Step 2: Run the CI sequence from the repo root:** `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @trackthat/infra exec cdk synth`. Expected: all pass.
- [ ] **Step 3: Check the docs against the code.** Confirm the repo variable names in the README exactly match `vars.AWS_DEPLOY_ROLE_ARN` and `vars.AWS_REGION` in `deploy.yml`, and the output name matches `DeployRoleArn` in the stack.
- [ ] **Step 4: Commit** `docs: document deploying`.
