import { Task } from "@domain/model/Task.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

export interface TaskRepository {
  findAll(): Promise<Task[]>;
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findById(taskId: string): Promise<Task | null>;
  create(title: string, description: string | null, projectId: string, storyId?: string): Promise<Task>;
  save(task: Task): Promise<void>;
}
