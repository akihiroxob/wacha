import { TaskStatus } from "@constants/TaskStatus.ts";
import { StoryTaskSyncService } from "@application/service/StoryTaskSyncService.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class ClaimTaskUseCase {
  private storyTaskSyncService: StoryTaskSyncService | null;

  constructor(
    private taskRepository: TaskRepository,
    storyRepository?: StoryRepository,
  ) {
    this.storyTaskSyncService = storyRepository
      ? new StoryTaskSyncService(taskRepository, storyRepository)
      : null;
  }

  async execute(taskId: string, assignee: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.REJECTED)
      throw new Error("Task is not in todo or rejected status");

    task.claim(assignee);
    await this.taskRepository.save(task);
    await this.storyTaskSyncService?.syncByTask(task);
  }
}
