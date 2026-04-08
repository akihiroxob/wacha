import { StoryStatus } from "@constants/StoryStatus.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";

export class ClaimStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(storyId: string): Promise<void> {
    const story = await this.storyRepository.findById(storyId);
    if (!story) throw new Error("Story not found");
    if (story.status !== StoryStatus.TODO) {
      throw new Error("Story is not in todo status");
    }

    story.claim();
    await this.storyRepository.save(story);
  }
}
