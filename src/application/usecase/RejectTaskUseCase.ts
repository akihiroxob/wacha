import { TaskStatus } from "@constants/TaskStatus.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class RejectTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, reason: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`the task(${taskId}) is not exists`);
    if (task.status !== TaskStatus.IN_REVIEW) {
      throw new Error(`the task(${taskId}) is not in in_review status`);
    }

    task.reject(reason);
    await this.taskRepository.save(task);
  }
}
