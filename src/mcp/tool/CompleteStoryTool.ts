import { z } from "zod";
import { completeStoryUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type CompleteStoryInput = {
  storyId: string;
};

export const CompleteStoryTool = {
  config: {
    title: "Complete Story",
    description: "Move a doing story to done.",
    inputSchema: {
      storyId: z.string().min(1).describe("Story ID"),
    },
  },
  execute: async ({ storyId }: CompleteStoryInput) => {
    await completeStoryUseCase.execute(storyId);
    return toTextResult({ storyId, status: "done" }, `Completed story ${storyId}.`);
  },
};
