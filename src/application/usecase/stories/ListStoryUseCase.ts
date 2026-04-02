import { Story } from "@domain/model/Story.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";

interface ListStoryUseCaseResult {
  stories: Story[];
}

export class ListStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(projectId: string, status?: StoryStatus): Promise<ListStoryUseCaseResult> {
    const stories = await this.storyRepository.findByProjectId(projectId);
    const filteredStories = status
      ? stories.filter((story) => story.status === status)
      : stories;
    return {
      stories: filteredStories.sort((a, b) => a.createdAt - b.createdAt),
    };
  }
}
