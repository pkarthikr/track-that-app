import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import {
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export interface WebStackProps extends StackProps {
  readonly webAssetPath?: string;
  readonly apiEndpoint?: string;
}

const defaultWebAssetPath = fileURLToPath(new URL("../../apps/web/dist", import.meta.url));

export function resolveWebAssetPath(
  webAssetPath: string | undefined,
  defaultPath: string = defaultWebAssetPath,
): string {
  if (webAssetPath !== undefined) return webAssetPath;
  if (!existsSync(join(defaultPath, "index.html"))) {
    throw new Error(
      `No web build found at ${defaultPath}. Build the web app first: pnpm --filter @trackthat/web build`,
    );
  }
  return defaultPath;
}

export class WebStack extends Stack {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props?: WebStackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Assumes the app has no inline styles or scripts. connect-src uses this
    // stack's region, while the app takes the Cognito region from the user pool
    // id, so the CSP only matches if TrackThatAuth is deployed to the same
    // region as this stack.
    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      [
        `connect-src 'self' https://cognito-idp.${this.region}.amazonaws.com`,
        ...(props?.apiEndpoint === undefined ? [] : [props.apiEndpoint]),
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const responseHeadersPolicy = new ResponseHeadersPolicy(this, "SecurityHeaders", {
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        contentSecurityPolicy: { contentSecurityPolicy, override: true },
      },
    });

    this.distribution = new Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy,
      },
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: "/index.html",
      })),
    });

    new BucketDeployment(this, "DeployWeb", {
      sources: [Source.asset(resolveWebAssetPath(props?.webAssetPath))],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    new CfnOutput(this, "WebUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
  }
}
