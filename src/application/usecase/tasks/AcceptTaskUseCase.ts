import { TaskStatus } from "@constants/TaskStatus.ts";
import { StoryTaskSyncService } from "@application/service/StoryTaskSyncService.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class AcceptTaskUseCase {
  private storyTaskSyncService: StoryTaskSyncService | null;

  constructor(
    private taskRepository: TaskRepository,
    storyRepository?: StoryRepository,
  ) {
    this.storyTaskSyncService = storyRepository
      ? new StoryTaskSyncService(taskRepository, storyRepository)
      : null;
  }

  async execute(taskId: string, acceptorSessionId?: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`the task(${taskId}) is not exists`);
    if (task.status !== TaskStatus.IN_REVIEW && task.status !== TaskStatus.WAIT_ACCEPT) {
      throw new Error(`the task(${taskId}) is not in acceptable review status`);
    }
    // 自己受入禁止: 担当者自身は accepted にできない
    if (acceptorSessionId && task.assignee === acceptorSessionId) {
      throw new Error(`the task(${taskId}) cannot be accepted by its own assignee`);
    }

    task.accept();
    await this.taskRepository.save(task);
    await this.storyTaskSyncService?.syncByTask(task);
  }
}
