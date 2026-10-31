import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { afterAll, describe, expect, it } from "vitest";

import { ApiStack, resolveApiAssetPath } from "./api-stack";

const fixture = mkdtempSync(join(tmpdir(), "api-"));
writeFileSync(join(fixture, "handler.js"), "exports.handler = async () => ({});");

const app = new App();
const scratch = new Stack(app, "Scratch");
const userPool = new UserPool(scratch, "Pool");
const userPoolClient = userPool.addClient("Client");

const template = Template.fromStack(
  new ApiStack(app, "TestApi", { userPool, userPoolClient, apiAssetPath: fixture }),
);

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

const routeKeys = [
  "GET /habits",
  "POST /habits",
  "GET /habits/{id}",
  "PATCH /habits/{id}",
  "PUT /habits/{id}/completions/{date}",
  "DELETE /habits/{id}/completions/{date}",
];

const tableId = Object.keys(template.findResources("AWS::DynamoDB::Table"))[0] as string;

describe("ApiStack", () => {
  it("stores habits in a retained on-demand table with point-in-time recovery", () => {
    template.hasResource("AWS::DynamoDB::Table", {
      Properties: {
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
        ]),
        BillingMode: "PAY_PER_REQUEST",
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      },
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("runs the handler on Node 22 with the table name", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Handler: "handler.handler",
      MemorySize: 256,
      Timeout: 10,
      Environment: { Variables: { TABLE_NAME: { Ref: tableId } } },
    });
  });

  it("grants the function access to the table only", () => {
    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    const statements = policies.flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement as { Resource: unknown }[],
    );
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      const json = JSON.stringify(statement.Resource);
      expect(json).not.toBe('"*"');
      expect(json).toContain(tableId);
    }
  });

  it("serves exactly the six habit routes behind the JWT authorizer", () => {
    const routes = Object.values(template.findResources("AWS::ApiGatewayV2::Route"));
    expect(routes.map((r) => r.Properties.RouteKey).sort()).toEqual([...routeKeys].sort());
    for (const route of routes) {
      expect(route.Properties.AuthorizationType).toBe("JWT");
    }
  });

  it("validates tokens against the user pool client", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      JwtConfiguration: {
        Audience: [{ "Fn::ImportValue": Match.stringLikeRegexp("PoolClient") }],
      },
    });
  });

  it("allows any origin without credentials", () => {
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: {
        AllowOrigins: ["*"],
        AllowHeaders: Match.arrayWith(["authorization", "content-type"]),
        AllowMethods: Match.arrayWith(["GET", "POST", "PATCH", "PUT", "DELETE"]),
        AllowCredentials: Match.absent(),
      },
    });
  });

  it("outputs the API URL", () => {
    template.hasOutput("ApiUrl", {});
  });

  it("explains how to build the API when the default asset path is missing", () => {
    const missing = join(fixture, "does-not-exist");
    expect(() => resolveApiAssetPath(undefined, missing)).toThrow(
      "pnpm --filter @trackthat/api build",
    );
    expect(resolveApiAssetPath(missing, "unused")).toBe(missing);
    expect(resolveApiAssetPath(undefined, fixture)).toBe(fixture);
  });
});
