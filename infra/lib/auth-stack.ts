import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { AccountRecovery, Mfa, UserPool, type UserPoolClient } from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export class AuthStack extends Stack {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, "UserPool", {
      signInAliases: { email: true },
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      passwordPolicy: { minLength: 8 },
      mfa: Mfa.OFF,
      accountRecovery: AccountRecovery.NONE,
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      disableOAuth: true,
      authFlows: { userSrp: true },
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
    });

    new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
