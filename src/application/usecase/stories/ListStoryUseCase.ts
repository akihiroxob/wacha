import { Story } from "@domain/model/Story.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";

interface ListStoryUseCaseResult {
  stories: Story[];
}

export class ListStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(projectId: string): Promise<ListStoryUseCaseResult> {
    const stories = await this.storyRepository.findByProjectId(projectId);
    return {
      stories: stories.sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }
}
