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

    task.complete();
    await this.taskRepository.save(task);
  }
}
