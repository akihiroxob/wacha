import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { createApp } from "../../../src/app.ts";

// createMcpServer の登録配線(withRoleGuard + sessionId closure)ごと検証するため、
// MCP エンドポイントを実際に叩いて claim_task / complete_task の許可・拒否を確認する
const app = createApp();

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

let rpcId = 0;

const parseSse = (text: string) => {
  const dataLine = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .pop();
  if (!dataLine) throw new Error(`no data line in MCP response: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(6));
};

const initializeSession = async (): Promise<string> => {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "guard-test", version: "1.0" },
      },
    }),
  });
  await res.text();
  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("MCP initialize did not return a session id");
  return sessionId;
};

const callTool = async (sessionId: string, name: string, args: Record<string, unknown>) => {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: { ...MCP_HEADERS, "mcp-session-id": sessionId },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const rpc = parseSse(await res.text());
  const result = rpc.result ?? {};
  const text: string = result.content?.[0]?.text ?? "";
  return { isError: Boolean(result.isError), text, structured: result.structuredContent };
};

const parsePayload = (toolResult: { text: string; structured?: unknown }) =>
  (toolResult.structured ?? JSON.parse(toolResult.text)) as Record<string, any>;

const setupProjectWithTask = async () => {
  const manager = await initializeSession();
  const assignResult = parsePayload(
    await callTool(manager, "assign_project_role", {
      baseDir: "repo/guard-test",
      projectName: "GuardTest",
      requestedRole: "manager",
    }),
  );
  const task = parsePayload(
    await callTool(manager, "issue_task", {
      projectId: assignResult.projectId,
      title: "Guard Task",
    }),
  );
  return { manager, projectId: assignResult.projectId as string, taskId: task.id as string };
};

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("claim_task and complete_task are forbidden for manager sessions via the MCP endpoint", async () => {
  const { manager, taskId } = await setupProjectWithTask();

  const claim = await callTool(manager, "claim_task", { taskId });
  assert.equal(claim.isError, true);
  assert.match(claim.text, /Forbidden: Agent does not have required role/);

  const complete = await callTool(manager, "complete_task", { taskId });
  assert.equal(complete.isError, true);
  assert.match(complete.text, /Forbidden: Agent does not have required role/);
});

test("claim_task is forbidden for reviewer sessions via the MCP endpoint", async () => {
  const { taskId } = await setupProjectWithTask();

  const reviewer = await initializeSession();
  await callTool(reviewer, "assign_project_role", {
    baseDir: "repo/guard-test",
    projectName: "GuardTest",
    requestedRole: "reviewer",
  });

  const claim = await callTool(reviewer, "claim_task", { taskId });
  assert.equal(claim.isError, true);
  assert.match(claim.text, /Forbidden: Agent does not have required role/);
});

test("claim_task and complete_task succeed for worker sessions via the MCP endpoint", async () => {
  const { taskId } = await setupProjectWithTask();

  const worker = await initializeSession();
  await callTool(worker, "assign_project_role", {
    baseDir: "repo/guard-test",
    projectName: "GuardTest",
    requestedRole: "worker",
  });

  const claim = parsePayload(await callTool(worker, "claim_task", { taskId }));
  assert.equal(claim.status, "doing");

  await callTool(worker, "add_task_comment", { taskId, body: "実装と検証を実施" });
  const complete = parsePayload(await callTool(worker, "complete_task", { taskId }));
  assert.equal(complete.status, "in_review");
});
