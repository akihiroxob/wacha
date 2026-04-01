import { Story } from "@domain/model/Story.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";

export class IssueStoryUseCase {
  constructor(private storyRepository: StoryRepository) {}

  async execute(projectId: string, title: string, description: string | null): Promise<Story> {
    return this.storyRepository.create(projectId, title, description);
  }
}
