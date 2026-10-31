import { AuthUserPool } from "@pkarthikr/auth-cdk";
import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import type { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export class AuthStack extends Stack {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const auth = new AuthUserPool(this, "Auth");
    this.userPool = auth.userPool;
    this.userPoolClient = auth.userPoolClient;

    new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
