import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as container from "container.ts";

function toTextResult(data: unknown, message?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: message ?? JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data as Record<string, unknown>,
  };
}

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "wacha",
      version: "1.0.0",
    },
    {
      instructions:
        "Task management server for listing, issuing, claiming, completing, accepting, and rejecting tasks.",
    },
  );

  server.registerTool(
    "task_list",
    {
      title: "List Tasks",
      description: "List all tasks with summary information.",
    },
    async () => {
      const result = await container.listTaskUseCase.execute();
      return toTextResult(
        result,
        `Returned ${result.summary.total} tasks with status summary.`,
      );
    },
  );

  server.registerTool(
    "task_issue",
    {
      title: "Issue Task",
      description: "Create a new task in todo status.",
      inputSchema: {
        title: z.string().min(1).describe("Task title"),
        description: z.string().optional().describe("Optional task description"),
        projectId: z.string().min(1).describe("Project ID"),
        storyId: z.string().optional().describe("Optional parent story ID"),
      },
    },
    async ({ title, description, projectId, storyId }) => {
      const task = await container.issueTaskUseCase.execute(
        title,
        description ?? null,
        projectId,
        storyId,
      );
      return toTextResult(task, `Created task ${task.id}.`);
    },
  );

  server.registerTool(
    "task_claim",
    {
      title: "Claim Task",
      description: "Assign a todo task to a worker and move it to doing.",
      inputSchema: {
        taskId: z.string().min(1).describe("Task ID"),
        workerId: z.string().min(1).describe("Worker ID"),
      },
    },
    async ({ taskId, workerId }) => {
      await container.claimTaskUseCase.execute(taskId, workerId);
      return toTextResult({ taskId, workerId, status: "doing" }, `Claimed task ${taskId}.`);
    },
  );

  server.registerTool(
    "task_complete",
    {
      title: "Complete Task",
      description: "Move a doing task to in_review.",
      inputSchema: {
        taskId: z.string().min(1).describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      await container.completeTaskUseCase.execute(taskId);
      return toTextResult({ taskId, status: "in_review" }, `Completed task ${taskId}.`);
    },
  );

  server.registerTool(
    "task_accept",
    {
      title: "Accept Task",
      description: "Move an in_review task to accepted.",
      inputSchema: {
        taskId: z.string().min(1).describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      await container.acceptTaskUseCase.execute(taskId);
      return toTextResult({ taskId, status: "accepted" }, `Accepted task ${taskId}.`);
    },
  );

  server.registerTool(
    "task_reject",
    {
      title: "Reject Task",
      description: "Move an in_review task to rejected.",
      inputSchema: {
        taskId: z.string().min(1).describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      await container.rejectTaskUseCase.execute(taskId);
      return toTextResult({ taskId, status: "rejected" }, `Rejected task ${taskId}.`);
    },
  );

  return server;
}
