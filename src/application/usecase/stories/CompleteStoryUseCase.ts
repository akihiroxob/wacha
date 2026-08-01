import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class CompleteStoryUseCase {
  constructor(
    private storyRepository: StoryRepository,
    private taskRepository?: TaskRepository,
  ) {}

  async execute(storyId: string): Promise<void> {
    const story = await this.storyRepository.findById(storyId);
    if (!story) throw new Error("Story not found");
    if (story.status !== StoryStatus.DOING) {
      throw new Error("Story is not in doing status");
    }

    // 配下の task が全て accepted / canceled になるまで done にできない
    if (this.taskRepository) {
      const storyTasks = (await this.taskRepository.findByProjectId(story.projectId)).filter(
        (task) => task.storyId === storyId,
      );
      const unsettledTasks = storyTasks.filter(
        (task) => task.status !== TaskStatus.ACCEPTED && task.status !== TaskStatus.CANCELED,
      );
      if (unsettledTasks.length > 0) {
        const countsByStatus = unsettledTasks.reduce<Record<string, number>>((counts, task) => {
          counts[task.status] = (counts[task.status] ?? 0) + 1;
          return counts;
        }, {});
        const countsText = Object.entries(countsByStatus)
          .map(([status, count]) => `${status}: ${count}`)
          .join(", ");
        throw new Error(
          `the story(${storyId}) still has ${unsettledTasks.length} unsettled task(s) (${countsText}). All tasks must be accepted or canceled before complete_story`,
        );
      }
    }

    story.complete();
    await this.storyRepository.save(story);
  }
}
