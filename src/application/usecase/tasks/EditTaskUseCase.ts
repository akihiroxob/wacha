import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class EditTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(projectId: string, taskId: string, title: string, description: string | null) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    if (projectId !== task.projectId) {
      throw new Error("Task does not belong to the specified project");
    }

    task.changeTitle(title);
    task.changeDescription(description ?? "");

    await this.taskRepository.save(task);
    return task;
  }
}
