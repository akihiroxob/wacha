import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "@application/error/ValidationError.ts";
import { SessionReinitializeRequiredError } from "@application/error/SessionInvalidError.ts";
import { toMcpErrorResponse } from "@mcp/utils/toMcpErrorResponse.ts";

test("toMcpErrorResponse returns reinitialize contract for missing session", () => {
  const response = toMcpErrorResponse(new SessionReinitializeRequiredError());

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    jsonrpc: "2.0",
    error: {
      code: -32001,
      message: "Session expired or server restarted; initialize again",
      data: {
        reason: "session_not_found",
        retry: "initialize",
      },
    },
    id: null,
  });
});

test("toMcpErrorResponse keeps validation errors as generic client errors", () => {
  const response = toMcpErrorResponse(new ValidationError("Initialization required"));

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Initialization required",
    },
    id: null,
  });
});

test("toMcpErrorResponse masks non-validation errors as internal errors", () => {
  const response = toMcpErrorResponse(new Error("boom"));

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "boom",
    },
    id: null,
  });
});
