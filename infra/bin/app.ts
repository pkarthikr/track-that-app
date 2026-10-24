import { App } from "aws-cdk-lib";

import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import { GithubOidcStack } from "../lib/github-oidc-stack";
import { WebStack } from "../lib/web-stack";

const app = new App();

new ApiStack(app, "TrackThatApi");
new AuthStack(app, "TrackThatAuth");
new GithubOidcStack(app, "GithubOidcStack");
new WebStack(app, "TrackThatWeb");

app.synth();
