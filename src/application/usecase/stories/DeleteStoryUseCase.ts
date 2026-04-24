import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";

export class DeleteStoryUseCase {
  constructor(
    private storyRepository: StoryRepository,
    private taskRepository: TaskRepository,
  ) {}

  async execute(storyId: string): Promise<void> {
    const story = await this.storyRepository.findById(storyId);
    if (!story) throw new Error("Story not found");
    if (story.status !== StoryStatus.TODO && story.status !== StoryStatus.CANCELED) {
      throw new Error("Only todo or canceled story can be deleted");
    }

    await this.taskRepository.deleteByStoryId(storyId);
    await this.storyRepository.delete(storyId);
  }
}
