import { TaskReject } from "@domain/model/TaskReject.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

export class ListTaskRejectUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<{ rejects: TaskReject[] }> {
    return { rejects: await this.taskRepository.findRejectsByTaskId(taskId) };
  }

  async executeForTasks(taskIds: string[]): Promise<{ rejects: TaskReject[] }> {
    return { rejects: await this.taskRepository.findRejectsByTaskIds(taskIds) };
  }
}
