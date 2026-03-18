import { TaskStatus } from "@constants/TaskStatus.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class ClaimTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, assignee: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.REJECTED)
      throw new Error("Task is not in todo or rejected status");

    task.claim(assignee);
    await this.taskRepository.save(task);
  }
}
