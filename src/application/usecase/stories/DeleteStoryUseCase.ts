import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class DeleteStoryUseCase {
  constructor(
    private storyRepository: StoryRepository,
    private taskRepository: TaskRepository,
  ) {}

  async execute(storyId: string): Promise<void> {
    const story = await this.storyRepository.findById(storyId);
    if (!story) throw new Error("Story not found");

    await this.taskRepository.deleteByStoryId(storyId);
    await this.storyRepository.delete(storyId);
  }
}
