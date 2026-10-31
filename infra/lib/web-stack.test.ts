import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { afterAll, describe, expect, it } from "vitest";

import { WebStack, resolveWebAssetPath } from "./web-stack";

const fixture = mkdtempSync(join(tmpdir(), "web-"));
writeFileSync(join(fixture, "index.html"), "<!doctype html><title>t</title>");

const template = Template.fromStack(new WebStack(new App(), "TestWeb", { webAssetPath: fixture }));

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

type Statement = {
  Effect?: string;
  Principal?: unknown;
  Action?: unknown;
  Condition?: Record<string, Record<string, unknown>>;
};

const isPublicPrincipal = (principal: unknown): boolean =>
  principal === "*" ||
  (typeof principal === "object" &&
    principal !== null &&
    (principal as { AWS?: unknown }).AWS === "*");

describe("WebStack", () => {
  it("blocks all public access and encrypts the bucket", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      WebsiteConfiguration: Match.absent(),
    });
  });

  it("never allows a public principal in the bucket policy", () => {
    const policies = Object.values(template.findResources("AWS::S3::BucketPolicy"));
    expect(policies.length).toBeGreaterThan(0);
    const statements: Statement[] = policies.flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement as Statement[],
    );
    const allows = statements.filter((s) => s.Effect === "Allow");
    expect(allows.length).toBeGreaterThan(0);
    for (const statement of allows) {
      expect(isPublicPrincipal(statement.Principal)).toBe(false);
    }
    expect(
      statements.some(
        (s) => s.Effect === "Deny" && s.Condition?.Bool?.["aws:SecureTransport"] === "false",
      ),
    ).toBe(true);
  });

  it("limits CloudFront read access to this distribution only", () => {
    const distributionIds = Object.keys(template.findResources("AWS::CloudFront::Distribution"));
    expect(distributionIds).toHaveLength(1);
    const distributionId = distributionIds[0] as string;
    const statements: Statement[] = Object.values(
      template.findResources("AWS::S3::BucketPolicy"),
    ).flatMap((policy) => policy.Properties.PolicyDocument.Statement as Statement[]);
    const cloudfrontAllows = statements.filter(
      (s) =>
        s.Effect === "Allow" &&
        (s.Principal as { Service?: string } | undefined)?.Service === "cloudfront.amazonaws.com",
    );
    expect(cloudfrontAllows.length).toBeGreaterThan(0);
    for (const statement of cloudfrontAllows) {
      expect(statement.Action).toBe("s3:GetObject");
      const sourceArn = statement.Condition?.StringEquals?.["AWS:SourceArn"];
      expect(sourceArn).toBeDefined();
      expect(JSON.stringify(sourceArn)).toContain(`{"Ref":"${distributionId}"}`);
    }
  });

  it("serves the bucket through origin access control", () => {
    const oacs = template.findResources("AWS::CloudFront::OriginAccessControl");
    const oacIds = Object.keys(oacs);
    expect(oacIds).toHaveLength(1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        Origins: [
          Match.objectLike({
            OriginAccessControlId: { "Fn::GetAtt": [oacIds[0], "Id"] },
          }),
        ],
      },
    });
  });

  it("redirects HTTP to HTTPS and serves index.html", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        PriceClass: "PriceClass_100",
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
          Compress: true,
        }),
        Aliases: Match.absent(),
        ViewerCertificate: Match.absent(),
      }),
    });
  });

  it("answers 403 and 404 with index.html", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponsePagePath: "/index.html", ResponseCode: 200 }),
          Match.objectLike({ ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: 200 }),
        ]),
      },
    });
  });

  it("sets the security headers", () => {
    const policies = template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
    const ids = Object.keys(policies);
    expect(ids).toHaveLength(1);
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: {
        SecurityHeadersConfig: Match.objectLike({
          StrictTransportSecurity: Match.objectLike({
            AccessControlMaxAgeSec: Match.anyValue(),
            IncludeSubdomains: true,
            Override: true,
          }),
          ContentTypeOptions: { Override: true },
          FrameOptions: { FrameOption: "DENY", Override: true },
          ReferrerPolicy: { ReferrerPolicy: "strict-origin-when-cross-origin", Override: true },
        }),
      },
    });
    const policyId = ids[0] as string;
    const config = policies[policyId]?.Properties.ResponseHeadersPolicyConfig;
    expect(
      config.SecurityHeadersConfig.StrictTransportSecurity.AccessControlMaxAgeSec,
    ).toBeGreaterThanOrEqual(31536000);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultCacheBehavior: Match.objectLike({
          ResponseHeadersPolicyId: { Ref: policyId },
        }),
      },
    });
  });

  it("pins the content security policy exactly", () => {
    const policies = Object.values(
      template.findResources("AWS::CloudFront::ResponseHeadersPolicy"),
    );
    const raw =
      policies[0]?.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig
        .ContentSecurityPolicy;
    expect(raw.Override).toBe(true);
    const value = raw.ContentSecurityPolicy as string | { "Fn::Join": [string, unknown[]] };
    const csp =
      typeof value === "string"
        ? value
        : value["Fn::Join"][1]
            .map((part) =>
              typeof part === "string"
                ? part
                : (part as { Ref?: string }).Ref === "AWS::Region"
                  ? "us-east-1"
                  : "?",
            )
            .join("");
    expect(csp).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp.split(/[\s;]+/)).not.toContain("*");
  });

  it("adds the API endpoint to connect-src only when provided", () => {
    const endpoint = "https://abc.execute-api.us-east-1.amazonaws.com";
    const withApi = Template.fromStack(
      new WebStack(new App(), "TestWebApi", { webAssetPath: fixture, apiEndpoint: endpoint }),
    );
    const policies = Object.values(withApi.findResources("AWS::CloudFront::ResponseHeadersPolicy"));
    const csp = JSON.stringify(
      policies[0]?.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig
        .ContentSecurityPolicy,
    );
    expect(csp).toContain(`amazonaws.com ${endpoint};`);
  });

  it("publishes the web build and invalidates the cache", () => {
    template.hasResourceProperties("Custom::CDKBucketDeployment", {
      Prune: true,
      DistributionPaths: ["/*"],
    });
  });

  it("outputs the site URL and bucket name", () => {
    template.hasOutput("WebUrl", {});
    template.hasOutput("BucketName", {});
  });

  it("explains how to build the web app when the default asset path is missing", () => {
    const missing = join(fixture, "does-not-exist");
    expect(() => resolveWebAssetPath(undefined, missing)).toThrow(
      "pnpm --filter @trackthat/web build",
    );
    expect(resolveWebAssetPath(missing, "unused")).toBe(missing);
    expect(resolveWebAssetPath(undefined, fixture)).toBe(fixture);
  });
});
