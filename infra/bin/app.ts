import { App } from "aws-cdk-lib";

import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";

const app = new App();

new ApiStack(app, "TrackThatApi");
new AuthStack(app, "TrackThatAuth");

app.synth();
