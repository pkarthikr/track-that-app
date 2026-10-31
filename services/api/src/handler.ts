import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

import { createDynamoStore } from "./dynamoStore";
import { errorResponse, HttpError } from "./http";
import { routes } from "./routes";
import type { HabitStore } from "./store";

export interface HandlerDeps {
  store: HabitStore;
  now: () => Date;
}

type Handler = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<APIGatewayProxyResultV2>;

export function createHandler({ store, now }: HandlerDeps): Handler {
  return async (event) => {
    try {
      const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
      if (typeof userId !== "string" || userId === "") {
        return errorResponse("unauthorized", "missing or invalid credentials");
      }
      const route = routes[event.routeKey];
      if (route === undefined) {
        return errorResponse("not-found", "no such route");
      }
      return await route({ store, now, userId, event });
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.code, error.message);
      }
      // Log only the error's name and message: never request data or stacks.
      const name = error instanceof Error ? error.name : "NonError";
      const message = error instanceof Error ? error.message : "unknown";
      console.error(JSON.stringify({ name, message }));
      return errorResponse("internal", "internal error");
    }
  };
}

let lazyHandler: Handler | undefined;

export const handler: Handler = (event) => {
  lazyHandler ??= createHandler({
    store: createDynamoStore(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      process.env.TABLE_NAME ?? "",
    ),
    now: () => new Date(),
  });
  return lazyHandler(event);
};
