import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";

import { AuthStack } from "./auth-stack";

const template = Template.fromStack(new AuthStack(new App(), "TestAuth"));

describe("AuthStack", () => {
  it("signs in by email, case-insensitively, with email auto-verified", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
      AutoVerifiedAttributes: ["email"],
      UsernameConfiguration: { CaseSensitive: false },
    });
  });

  it("enforces an 8 character minimum password and no MFA or account recovery", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      Policies: { PasswordPolicy: { MinimumLength: 8 } },
      MfaConfiguration: "OFF",
      AccountRecoverySetting: {
        RecoveryMechanisms: [{ Name: "admin_only", Priority: 1 }],
      },
    });
  });

  it("creates a public SRP-only client with token revocation", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      EnableTokenRevocation: true,
      GenerateSecret: false,
      AllowedOAuthFlows: Match.absent(),
      AllowedOAuthFlowsUserPoolClient: false,
    });
  });

  it("uses 1 hour access and ID tokens", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes" },
    });
  });

  it("outputs the pool and client ids", () => {
    template.hasOutput("UserPoolId", {});
    template.hasOutput("UserPoolClientId", {});
    expect(Object.keys(template.findOutputs("*"))).toHaveLength(2);
  });
});
