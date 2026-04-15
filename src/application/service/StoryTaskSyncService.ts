import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import type { Task } from "@domain/model/Task.ts";
import type { StoryRepository } from "@domain/repository/StoryRepository.ts";
import type { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class StoryTaskSyncService {
  constructor(
    private taskRepository: TaskRepository,
    private storyRepository: StoryRepository,
  ) {}

  async syncByTask(task: Task): Promise<void> {
    if (!task.storyId) return;

    const story = await this.storyRepository.findById(task.storyId);
    if (!story) return;

    const storyTasks = (await this.taskRepository.findByProjectId(task.projectId)).filter(
      (candidate) => candidate.storyId === task.storyId,
    );

    if (story.status === StoryStatus.TODO && task.status === TaskStatus.DOING) {
      story.claim();
      await this.storyRepository.save(story);
      return;
    }

    if (
      story.status === StoryStatus.DOING &&
      storyTasks.length > 0 &&
      storyTasks.every((candidate) => candidate.status === TaskStatus.ACCEPTED)
    ) {
      story.complete();
      await this.storyRepository.save(story);
    }
  }
}
