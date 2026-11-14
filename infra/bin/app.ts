import { App } from "aws-cdk-lib";

import { GithubOidcStack } from "../lib/github-oidc-stack";
import { resolveWebCustomDomain } from "../lib/web-domain-config";
import { WebStack } from "../lib/web-stack";

const app = new App();

new GithubOidcStack(app, "GithubOidcStack");
const customDomain = resolveWebCustomDomain(process.env);
new WebStack(app, "TrackThatWeb", {
  ...(customDomain === undefined ? {} : { customDomain }),
});

app.synth();
