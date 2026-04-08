import test from "node:test";
import assert from "node:assert/strict";

import { resolveWorkerId } from "@mcp/resolveWorkerId.ts";

test("resolveWorkerId returns explicit worker id when header is present", () => {
  assert.equal(resolveWorkerId(" worker-1 "), "worker-1");
});

test("resolveWorkerId generates automatic worker id when header is absent", () => {
  const resolved = resolveWorkerId();

  assert.match(resolved, /^auto:[0-9a-f-]{36}$/);
});

