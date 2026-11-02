import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Arn, ArnFormat, CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import {
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

export interface WebCustomDomain {
  readonly domainName: string;
  // An ISSUED ACM certificate for domainName, in us-east-1 (CloudFront requires it).
  readonly certificateArn: string;
  // Also serve www.<domainName>, redirecting it to the apex with a 301.
  readonly includeWww?: boolean;
}

export interface WebStackProps extends StackProps {
  readonly webAssetPath?: string;
  readonly apiEndpoint?: string;
  readonly customDomain?: WebCustomDomain;
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

// CloudFront Function (cloudfront-js-2.0) that 301s www.<domainName> to the apex.
export function wwwRedirectFunctionCode(domainName: string): string {
  return `function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;
  if (host !== ${JSON.stringify(`www.${domainName}`)}) {
    return request;
  }
  var pairs = [];
  var query = request.querystring || {};
  for (var key in query) {
    pairs.push(key + "=" + query[key].value);
  }
  var location = "https://" + ${JSON.stringify(domainName)} + request.uri + (pairs.length > 0 ? "?" + pairs.join("&") : "");
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: { location: { value: location } },
  };
}`;
}

const domainNamePattern =
  /^(?!www\.)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function validateCustomDomain(customDomain: WebCustomDomain): void {
  if (!domainNamePattern.test(customDomain.domainName)) {
    throw new Error(
      `Invalid domainName "${customDomain.domainName}": use a lowercase hostname with no trailing dot and no leading "www."`,
    );
  }
  if (
    Arn.split(customDomain.certificateArn, ArnFormat.SLASH_RESOURCE_NAME).region !== "us-east-1"
  ) {
    throw new Error(
      `certificateArn must be an ACM certificate in us-east-1 (CloudFront requirement): ${customDomain.certificateArn}`,
    );
  }
}

export class WebStack extends Stack {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props?: WebStackProps) {
    super(scope, id, props);

    if (props?.customDomain !== undefined) validateCustomDomain(props.customDomain);

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
      ...(props?.customDomain === undefined
        ? {}
        : {
            domainNames: [
              props.customDomain.domainName,
              ...(props.customDomain.includeWww === true
                ? [`www.${props.customDomain.domainName}`]
                : []),
            ],
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            certificate: Certificate.fromCertificateArn(
              this,
              "CustomDomainCertificate",
              props.customDomain.certificateArn,
            ),
          }),
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy,
        ...(props?.customDomain?.includeWww === true
          ? {
              functionAssociations: [
                {
                  function: new Function(this, "WwwRedirect", {
                    code: FunctionCode.fromInline(
                      wwwRedirectFunctionCode(props.customDomain.domainName),
                    ),
                    runtime: FunctionRuntime.JS_2_0,
                  }),
                  eventType: FunctionEventType.VIEWER_REQUEST,
                },
              ],
            }
          : {}),
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
      value: `https://${props?.customDomain?.domainName ?? this.distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
    });
    new CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
  }
}
