import { z } from "zod";
import { issueStoryUseCase } from "@container";
import { pushNotifier } from "@mcp/pushNotifier.ts";
import { toTextResult } from "@utils/mcpUtils.ts";

type IssueStoryInput = {
  projectId: string;
  title: string;
  description?: string;
};

export const IssueStoryTool = {
  config: {
    title: "Issue Story",
    description: "Create a new story in todo status.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
      title: z.string().min(1).describe("Story title"),
      description: z.string().optional().describe("Optional story description"),
    },
  },
  execute: async ({ projectId, title, description }: IssueStoryInput) => {
    const story = await issueStoryUseCase.execute(projectId, title, description ?? null);
    await pushNotifier.notifyManagersStoryCreated(story);
    return toTextResult(story, `Created story ${story.id}.`);
  },
};
