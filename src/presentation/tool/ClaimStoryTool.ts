import { z } from "zod";
import { claimStoryUseCase } from "@container";
import { toTextResult } from "@utils/mcpUtils.ts";

type ClaimStoryInput = {
  storyId: string;
};

export const ClaimStoryTool = {
  config: {
    title: "Claim Story",
    description: "Move a todo story to doing.",
    inputSchema: {
      storyId: z.string().min(1).describe("Story ID"),
    },
  },
  execute: async ({ storyId }: ClaimStoryInput) => {
    await claimStoryUseCase.execute(storyId);
    return toTextResult({ storyId, status: "doing" }, `Claimed story ${storyId}.`);
  },
};
