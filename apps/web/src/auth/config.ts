import { Amplify } from "aws-amplify";

export type AuthConfig = { userPoolId: string; userPoolClientId: string };

type Env = Record<string, string | undefined>;

export function readAuthConfig(env: Env): AuthConfig {
  const userPoolId = env.VITE_USER_POOL_ID;
  const userPoolClientId = env.VITE_USER_POOL_CLIENT_ID;
  const missing: string[] = [];
  if (!userPoolId) missing.push("VITE_USER_POOL_ID");
  if (!userPoolClientId) missing.push("VITE_USER_POOL_CLIENT_ID");
  if (!userPoolId || !userPoolClientId) {
    throw new Error(`Missing auth configuration: ${missing.join(", ")}`);
  }
  return { userPoolId, userPoolClientId };
}

export function configureAuth(env: Env = import.meta.env): void {
  const { userPoolId, userPoolClientId } = readAuthConfig(env);
  Amplify.configure({
    Auth: { Cognito: { userPoolId, userPoolClientId } },
  });
}
