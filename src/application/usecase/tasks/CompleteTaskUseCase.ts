import { TaskStatus } from "@constants/TaskStatus.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class CompleteTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`the task(${taskId}) is not exists`);
    if (task.status !== TaskStatus.DOING) {
      throw new Error(`the task(${taskId}) is not in doing status`);
    }

    // 担当者自身の検証コメントがない task は in_review に進めない
    const comments = await this.taskRepository.findCommentsByTaskId(taskId);
    const hasAssigneeComment =
      task.assignee !== null && comments.some((comment) => comment.sessionId === task.assignee);
    if (!hasAssigneeComment) {
      throw new Error(
        `the task(${taskId}) has no comment from its assignee. Record implementation and verification notes with add_task_comment before calling complete_task`,
      );
    }

    task.complete();
    await this.taskRepository.save(task);
  }
}
