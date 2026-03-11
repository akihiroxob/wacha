import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { Task } from "@domain/model/Task.ts";

export class IssueTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(title: string, description?: string): Promise<Task> {
    return this.taskRepository.create(title, description);
  }
}
