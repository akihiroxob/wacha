import { TaskStatus } from "@constants/TaskStatus.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class ReviewedTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, reviewerSessionId?: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`the task(${taskId}) is not exists`);
    if (task.status !== TaskStatus.IN_REVIEW) {
      throw new Error(`the task(${taskId}) is not in in_review status`);
    }
    // 自己レビュー禁止: 担当者自身は wait_accept に進められない
    if (reviewerSessionId && task.assignee === reviewerSessionId) {
      throw new Error(`the task(${taskId}) cannot be reviewed by its own assignee`);
    }

    task.reviewed();
    await this.taskRepository.save(task);
  }
}
