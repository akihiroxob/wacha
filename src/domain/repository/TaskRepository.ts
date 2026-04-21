import { Task } from "@domain/model/Task.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";
import { TaskReject } from "@domain/model/TaskReject.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

export interface TaskRepository {
  findByProjectId(projectId: string): Promise<Task[]>;
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findById(taskId: string): Promise<Task | null>;
  create(title: string, description: string | null, projectId: string, storyId?: string): Promise<Task>;
  save(task: Task): Promise<void>;
  addComment(taskId: string, body: string, author?: string | null): Promise<TaskComment>;
  findCommentsByTaskId(taskId: string): Promise<TaskComment[]>;
  findCommentsByTaskIds(taskIds: string[]): Promise<TaskComment[]>;
  addReject(taskId: string, reason: string, author?: string | null): Promise<TaskReject>;
  findRejectsByTaskId(taskId: string): Promise<TaskReject[]>;
  findRejectsByTaskIds(taskIds: string[]): Promise<TaskReject[]>;
  delete(taskId: string): Promise<void>;
  deleteByStoryId(storyId: string): Promise<void>;
}
