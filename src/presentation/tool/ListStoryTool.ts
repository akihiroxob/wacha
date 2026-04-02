import { z } from "zod";
import { listStoryUseCase } from "@container";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { toTextResult } from "@utils/mcpUtils.ts";

type ListStoryToolInput = {
  projectId: string;
  status?: StoryStatus;
};

export const ListStoryTool = {
  config: {
    title: "List Stories",
    description: "List stories for a project.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
      status: z
        .enum([StoryStatus.TODO, StoryStatus.DOING, StoryStatus.DONE, StoryStatus.CANCELED])
        .optional()
        .describe("Optional story status filter"),
    },
  },
  execute: async ({ projectId, status }: ListStoryToolInput) => {
    const result = await listStoryUseCase.execute(projectId, status);
    return toTextResult(result, `Returned ${result.stories.length} stories.`);
  },
};
