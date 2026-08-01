import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "@application/error/ValidationError.ts";
import { toMcpErrorResponse } from "@mcp/utils/toMcpErrorResponse.ts";

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
