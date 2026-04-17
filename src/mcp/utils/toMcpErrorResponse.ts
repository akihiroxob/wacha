import { ValidationError } from "@application/error/ValidationError.ts";
import { SessionReinitializeRequiredError } from "@application/error/SessionReinitializeRequiredError.ts";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type McpErrorResponse = {
  status: ContentfulStatusCode;
  body: {
    jsonrpc: "2.0";
    error: {
      code: number;
      message: string;
      data?: Record<string, string>;
    };
    id: null;
  };
};

export const toMcpErrorResponse = (error: unknown): McpErrorResponse => {
  if (error instanceof SessionReinitializeRequiredError) {
    return {
      status: 400,
      body: {
        jsonrpc: "2.0",
        error: {
          code: error.rpcCode,
          message: error.message,
          data: error.rpcData,
        },
        id: null,
      },
    };
  }

  const status = error instanceof ValidationError ? 400 : 500;
  const message = error instanceof Error ? error.message : "Internal Server Error";

  return {
    status,
    body: {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message,
      },
      id: null,
    },
  };
};
