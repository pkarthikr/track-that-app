import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { IUserPool, IUserPoolClient } from "aws-cdk-lib/aws-cognito";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

export interface ApiStackProps extends StackProps {
  readonly userPool: IUserPool;
  readonly userPoolClient: IUserPoolClient;
  readonly apiAssetPath?: string;
}

const defaultApiAssetPath = fileURLToPath(new URL("../../services/api/dist", import.meta.url));

export function resolveApiAssetPath(
  apiAssetPath: string | undefined,
  defaultPath: string = defaultApiAssetPath,
): string {
  if (apiAssetPath !== undefined) return apiAssetPath;
  if (!existsSync(join(defaultPath, "handler.js"))) {
    throw new Error(
      `No API build found at ${defaultPath}. Build the API first: pnpm --filter @trackthat/api build`,
    );
  }
  return defaultPath;
}

export class ApiStack extends Stack {
  readonly table: Table;
  readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.table = new Table(this, "HabitsTable", {
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const handler = new LambdaFunction(this, "ApiHandler", {
      runtime: Runtime.NODEJS_22_X,
      handler: "handler.handler",
      code: Code.fromAsset(resolveApiAssetPath(props.apiAssetPath)),
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: this.table.tableName },
    });
    this.table.grantReadWriteData(handler);

    this.httpApi = new HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
        ],
      },
      defaultAuthorizer: new HttpUserPoolAuthorizer("JwtAuthorizer", props.userPool, {
        userPoolClients: [props.userPoolClient],
      }),
    });

    const integration = new HttpLambdaIntegration("ApiIntegration", handler);
    const routes: [string, HttpMethod][] = [
      ["/habits", HttpMethod.GET],
      ["/habits", HttpMethod.POST],
      ["/habits/{id}", HttpMethod.GET],
      ["/habits/{id}", HttpMethod.PATCH],
      ["/habits/{id}/completions/{date}", HttpMethod.PUT],
      ["/habits/{id}/completions/{date}", HttpMethod.DELETE],
    ];
    for (const [path, method] of routes) {
      this.httpApi.addRoutes({ path, methods: [method], integration });
    }

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
  }
}
