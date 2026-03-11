import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class ClaimTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, assignee: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "todo") throw new Error("Task is not in todo status");
    task.status = "doing";
    task.assignee = assignee;
    await this.taskRepository.save(task);
  }
}
