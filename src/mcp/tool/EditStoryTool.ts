import { z } from "zod";
import { editStoryUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type EditStoryInput = {
  projectId: string;
  storyId: string;
  title: string;
  description?: string;
};

export const EditStoryTool = {
  config: {
    title: "Edit Story",
    description: "Update an existing story title and description.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
      storyId: z.string().min(1).describe("Story ID"),
      title: z.string().min(1).describe("Updated story title"),
      description: z.string().optional().describe("Updated story description"),
    },
  },
  execute: async ({ projectId, storyId, title, description }: EditStoryInput) => {
    const story = await editStoryUseCase.execute(projectId, storyId, title, description ?? null);
    return toTextResult(story, `Updated story ${story.id}.`);
  },
};
