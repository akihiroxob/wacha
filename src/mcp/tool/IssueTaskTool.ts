import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { issueTaskUseCase } from "@container";

type IssueTaskInput = {
  title: string;
  description?: string;
  projectId: string;
  storyId?: string;
};

export const IssueTaskTool = {
  config: {
    title: "Issue Task",
    description: "Create a new task in todo status.",
    inputSchema: {
      title: z.string().min(1).describe("Task title"),
      description: z.string().optional().describe("Optional task description"),
      projectId: z.string().min(1).describe("Project ID"),
      storyId: z.string().optional().describe("Optional parent story ID"),
    },
  },
  execute: async ({ title, description, projectId, storyId }: IssueTaskInput) => {
    const task = await issueTaskUseCase.execute(title, description ?? null, projectId, storyId);
    return toTextResult(task, `Created task ${task.id}.`);
  },
};
