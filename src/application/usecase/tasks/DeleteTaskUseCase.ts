import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

export class DeleteTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.TODO) {
      throw new Error("Only todo task can be deleted");
    }
    await this.taskRepository.delete(taskId);
  }
}
