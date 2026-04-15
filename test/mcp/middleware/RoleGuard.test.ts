import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { canIssueTask } from "@mcp/middleware/RoleGuard.ts";

test("canIssueTask allows manager to create story-linked tasks", () => {
  assert.equal(canIssueTask([ProjectRole.MANAGER], "story-1"), true);
});

test("canIssueTask allows reviewer to create standalone tasks", () => {
  assert.equal(canIssueTask([ProjectRole.REVIEWER]), true);
});

test("canIssueTask denies reviewer for story-linked tasks", () => {
  assert.equal(canIssueTask([ProjectRole.REVIEWER], "story-1"), false);
});

test("canIssueTask denies worker for standalone tasks", () => {
  assert.equal(canIssueTask([ProjectRole.WORKER]), false);
});
