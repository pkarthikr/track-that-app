import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { GithubOidcStack } from "./github-oidc-stack";

const template = Template.fromStack(new GithubOidcStack(new App(), "TestOidc"));

type Statement = {
  Action: string | string[];
  Resource: unknown;
  NotAction?: unknown;
  NotResource?: unknown;
};

function policyStatements(): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => policy.Properties.PolicyDocument.Statement as Statement[],
  );
}

const [providerLogicalId] = Object.keys(template.findResources("AWS::IAM::OIDCProvider"));

describe("GithubOidcStack", () => {
  it("registers GitHub's OIDC provider", () => {
    template.hasResourceProperties("AWS::IAM::OIDCProvider", {
      Url: "https://token.actions.githubusercontent.com",
      ClientIdList: ["sts.amazonaws.com"],
    });
  });

  it("defines exactly one role and one policy", () => {
    template.resourceCountIs("AWS::IAM::Role", 1);
    template.resourceCountIs("AWS::IAM::Policy", 1);
  });

  it("only main of this repo can assume the role", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: "TrackThatGithubDeploy",
      ManagedPolicyArns: Match.absent(),
      Policies: Match.absent(),
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Action: "sts:AssumeRoleWithWebIdentity",
            Principal: { Federated: { "Fn::GetAtt": [providerLogicalId, "Arn"] } },
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub":
                  "repo:pkarthikr/track-that-app:ref:refs/heads/main",
              },
            },
          },
        ],
      },
    });
  });

  it("limits sessions to 1 hour", () => {
    template.hasResourceProperties("AWS::IAM::Role", { MaxSessionDuration: 3600 });
  });

  it("may only assume the CDK bootstrap roles", () => {
    const statements = policyStatements();
    expect(statements).toHaveLength(1);
    expect(statements[0]?.Action).toBe("sts:AssumeRole");
    expect(statements[0]?.Resource).toEqual({
      "Fn::Join": [
        "",
        [
          "arn:",
          { Ref: "AWS::Partition" },
          ":iam::",
          { Ref: "AWS::AccountId" },
          ":role/cdk-hnb659fds-*",
        ],
      ],
    });
    expect(statements[0]?.NotAction).toBeUndefined();
    expect(statements[0]?.NotResource).toBeUndefined();
  });

  it("grants no wildcard actions", () => {
    for (const statement of policyStatements()) {
      const actions = [statement.Action].flat();
      for (const action of actions) {
        expect(action).not.toBe("*");
        expect(action.endsWith(":*")).toBe(false);
      }
    }
  });

  it("outputs the role ARN", () => {
    template.hasOutput("DeployRoleArn", {});
  });
});
