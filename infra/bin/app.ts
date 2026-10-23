import { App } from "aws-cdk-lib";

import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import { GithubOidcStack } from "../lib/github-oidc-stack";

const app = new App();

new ApiStack(app, "TrackThatApi");
new AuthStack(app, "TrackThatAuth");
new GithubOidcStack(app, "GithubOidcStack");

app.synth();
