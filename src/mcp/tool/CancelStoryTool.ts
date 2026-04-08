import { z } from "zod";
import { cancelStoryUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type CancelStoryInput = {
  storyId: string;
};

export const CancelStoryTool = {
  config: {
    title: "Cancel Story",
    description: "Move a doing story to canceled.",
    inputSchema: {
      storyId: z.string().min(1).describe("Story ID"),
    },
  },
  execute: async ({ storyId }: CancelStoryInput) => {
    await cancelStoryUseCase.execute(storyId);
    return toTextResult({ storyId, status: "canceled" }, `Canceled story ${storyId}.`);
  },
};
