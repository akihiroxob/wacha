import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../../../src/app.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";

const app = createApp();
const projectRepository = new SQLiteProjectRepository();
const taskRepository = new SQLiteTaskRepository();
const grantRepository = new SQLiteProjectGrantRepository();
let rpcId = 0;

const headers = (principalId: string) => ({
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${principalId}`,
});

const parseSse = (text: string) => {
  const dataLine = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .pop();
  if (!dataLine) throw new Error(`no data line in MCP response: ${text.slice(0, 300)}`);
  return JSON.parse(dataLine.slice(6));
};

const call = async (principalId: string, method: string, params?: Record<string, unknown>) => {
  const response = await app.request("/mcp", {
    method: "POST",
    headers: headers(principalId),
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const rpc = parseSse(await response.text());
  return { response, rpc };
};

const callTool = async (principalId: string, name: string, args: Record<string, unknown>) => {
  const { rpc } = await call(principalId, "tools/call", { name, arguments: args });
  return rpc.result;
};

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("change_log").execute();
  await DatabaseClient.deleteFrom("command_receipt").execute();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task_claim").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_grant").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("stateless /mcp authenticates an Agent Name without creating a session", async () => {
  const { response, rpc } = await call("worker-a", "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "stateless-test", version: "1.0" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("mcp-session-id"), null);
  assert.equal(rpc.result.serverInfo.name, "wacha");
});

test("stateless Task tools use Principal grants and explicit Claim handles", async () => {
  const project = await projectRepository.create("Stateless", null, "repo/stateless");
  const task = await taskRepository.create("Task A", null, project.id);
  await grantRepository.grant(project.id, "worker-a", ProjectRole.WORKER);

  const listed = await callTool("worker-a", "list_tasks", {
    projectId: project.id,
    filter: { availableFor: "work" },
  });
  assert.equal(listed.structuredContent.tasks[0].id, task.id);

  const claimed = await callTool("worker-a", "claim_task", {
    taskId: task.id,
    requestId: "claim-1",
  });
  assert.equal(claimed.isError, undefined);
  assert.equal(typeof claimed.structuredContent.claimId, "string");

  const commented = await callTool("worker-a", "add_task_comment", {
    taskId: task.id,
    claimId: claimed.structuredContent.claimId,
    body: "verified",
    requestId: "comment-1",
  });
  assert.equal(commented.structuredContent.comment.principalId, "worker-a");
});

test("stateless Task tools return structured authorization errors", async () => {
  const project = await projectRepository.create("Stateless", null, "repo/stateless");
  const task = await taskRepository.create("Task A", null, project.id);
  await grantRepository.grant(project.id, "manager-a", ProjectRole.MANAGER);

  const listed = await callTool("manager-a", "list_tasks", {
    projectId: project.id,
    filter: { availableFor: "work" },
  });
  assert.equal(listed.structuredContent.tasks[0].id, task.id);

  const result = await callTool("manager-a", "claim_task", {
    taskId: task.id,
    requestId: "claim-forbidden",
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error.code, "FORBIDDEN");
});
