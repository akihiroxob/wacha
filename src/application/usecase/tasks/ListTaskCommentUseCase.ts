import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";

export class ListTaskCommentUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<{ comments: TaskComment[] }> {
    return { comments: await this.taskRepository.findCommentsByTaskId(taskId) };
  }

  async executeForTasks(taskIds: string[]): Promise<{ comments: TaskComment[] }> {
    return { comments: await this.taskRepository.findCommentsByTaskIds(taskIds) };
  }
}
