import { Aws, CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { CfnOIDCProvider, PolicyStatement, Role, WebIdentityPrincipal } from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

const GITHUB_REPO = "pkarthikr/track-that-app";
const DEPLOY_BRANCH = "main";

const OIDC_HOST = "token.actions.githubusercontent.com";

export class GithubOidcStack extends Stack {
  readonly deployRole: Role;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const provider = new CfnOIDCProvider(this, "GithubProvider", {
      url: `https://${OIDC_HOST}`,
      clientIdList: ["sts.amazonaws.com"],
    });

    this.deployRole = new Role(this, "DeployRole", {
      roleName: "TrackThatGithubDeploy",
      assumedBy: new WebIdentityPrincipal(provider.attrArn, {
        StringEquals: {
          [`${OIDC_HOST}:aud`]: "sts.amazonaws.com",
          [`${OIDC_HOST}:sub`]: `repo:${GITHUB_REPO}:ref:refs/heads/${DEPLOY_BRANCH}`,
        },
      }),
      maxSessionDuration: Duration.hours(1),
    });

    this.deployRole.addToPolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: this.deployRole.roleArn });
  }
}
