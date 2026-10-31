import type { APIGatewayProxyResultV2 } from "aws-lambda";

export type ErrorCode =
  "invalid-request" | "unauthorized" | "not-found" | "habit-limit" | "internal";

const STATUS: Record<ErrorCode, number> = {
  "invalid-request": 400,
  unauthorized: 401,
  "not-found": 404,
  "habit-limit": 409,
  internal: 500,
};

type Result = Exclude<APIGatewayProxyResultV2, string>;

export function json(statusCode: number, body: unknown): Result {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(code: ErrorCode, message: string): Result {
  return json(STATUS[code], { code, message });
}
