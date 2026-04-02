import { StoryStatus } from "@constants/StoryStatus.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";

export class CompleteStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(storyId: string): Promise<void> {
    const story = await this.storyRepository.findById(storyId);
    if (!story) throw new Error("Story not found");
    if (story.status !== StoryStatus.DOING) {
      throw new Error("Story is not in doing status");
    }

    story.complete();
    await this.storyRepository.save(story);
  }
}
