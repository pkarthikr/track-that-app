import { App } from "aws-cdk-lib";

import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import { GithubOidcStack } from "../lib/github-oidc-stack";
import { resolveWebCustomDomain } from "../lib/web-domain-config";
import { WebStack } from "../lib/web-stack";

const app = new App();

const auth = new AuthStack(app, "TrackThatAuth");
const api = new ApiStack(app, "TrackThatApi", {
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});
new GithubOidcStack(app, "GithubOidcStack");
const customDomain = resolveWebCustomDomain(process.env);
new WebStack(app, "TrackThatWeb", {
  apiEndpoint: api.httpApi.apiEndpoint,
  ...(customDomain === undefined ? {} : { customDomain }),
});

app.synth();
