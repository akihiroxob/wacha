import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";

export class AddTaskCommentUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string, body: string, author?: string | null): Promise<TaskComment> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new Error(`the task(${taskId}) is not exists`);
    if (body.trim() === "") throw new Error("comment body is required");
    return this.taskRepository.addComment(taskId, body.trim(), author ?? null);
  }
}
