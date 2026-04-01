import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class DeleteTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    await this.taskRepository.delete(taskId);
  }
}
