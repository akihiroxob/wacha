import { StoryRepository } from "@domain/repository/StoryRepository.ts";

export class EditStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(projectId: string, storyId: string, title: string, description: string | null) {
    const story = await this.storyRepository.findById(storyId);
    if (!story) {
      throw new Error("Story not found");
    }

    if (projectId !== story.projectId) {
      throw new Error("Story does not belong to the specified project");
    }

    story.changeTitle(title);
    story.changeDescription(description ?? "");

    await this.storyRepository.save(story);
    return story;
  }
}
