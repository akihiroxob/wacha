import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class CancelTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, reason: string, author?: string | null): Promise<void> {
    if (reason.trim() === "") {
      throw new Error("Cancel reason is required");
    }

    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");

    task.cancel();
    await this.taskRepository.save(task);
    await this.taskRepository.addComment(taskId, reason.trim(), author ?? null);
  }
}
