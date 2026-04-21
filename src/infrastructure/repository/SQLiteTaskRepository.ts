import { Task } from "@domain/model/Task.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";
import { TaskReject } from "@domain/model/TaskReject.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
export class SQLiteTaskRepository implements TaskRepository {
  async findByProjectId(projectId: string): Promise<Task[]> {
    const rows = await DatabaseClient.selectFrom("task")
      .selectAll()
      .where("project_id", "=", projectId)
      .execute();
    return rows.map(
      (row) =>
        new Task(
          row.id,
          row.project_id,
          row.story_id,
          row.title,
          row.description,
          row.status as TaskStatus,
          row.assignee,
          row.reject_reason,
          row.resume_source_status,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const rows = await DatabaseClient.selectFrom("task")
      .selectAll()
      .where("status", "=", status)
      .execute();
    return rows.map(
      (row) =>
        new Task(
          row.id,
          row.project_id,
          row.story_id,
          row.title,
          row.description,
          row.status as TaskStatus,
          row.assignee,
          row.reject_reason,
          row.resume_source_status,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findById(taskId: string): Promise<Task | null> {
    const row = await DatabaseClient.selectFrom("task")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();
    if (!row) return null;
    return new Task(
      row.id,
      row.project_id,
      row.story_id,
      row.title,
      row.description,
      row.status as TaskStatus,
      row.assignee,
      row.reject_reason,
      row.resume_source_status,
      row.created_at,
      row.updated_at,
    );
  }

  async create(title: string, description: string | null, projectId: string, storyId?: string) {
    const id = crypto.randomUUID();
    const now = Date.now();

    const task = await DatabaseClient.insertInto("task")
      .values({
        id,
        project_id: projectId,
        story_id: storyId ?? null,
        title,
        description: description ?? null,
        status: TaskStatus.TODO,
        assignee: null,
        reject_reason: null,
        resume_source_status: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Task(
      task.id,
      task.project_id,
      task.story_id,
      task.title,
      task.description,
      task.status as TaskStatus,
      task.assignee,
      task.reject_reason,
      task.resume_source_status,
      task.created_at,
      task.updated_at,
    );
  }

  async save(task: Task) {
    const existingTask = await this.findById(task.id);
    if (!existingTask) throw new Error("Task not found");

    await DatabaseClient.updateTable("task")
      .set({
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        reject_reason: task.rejectReason,
        resume_source_status: task.resumeSourceStatus,
        updated_at: Date.now(),
      })
      .where("id", "=", task.id)
      .execute();
  }

  async addComment(taskId: string, body: string, author?: string | null): Promise<TaskComment> {
    const row = await DatabaseClient.insertInto("task_comment")
      .values({
        id: crypto.randomUUID(),
        task_id: taskId,
        body: body.trim(),
        author: author ?? null,
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return new TaskComment(row.id, row.task_id, row.body, row.author, row.created_at);
  }

  async findCommentsByTaskId(taskId: string): Promise<TaskComment[]> {
    return this.findCommentsByTaskIds([taskId]);
  }

  async findCommentsByTaskIds(taskIds: string[]): Promise<TaskComment[]> {
    if (taskIds.length === 0) return [];
    const rows = await DatabaseClient.selectFrom("task_comment")
      .selectAll()
      .where("task_id", "in", taskIds)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((row) => new TaskComment(row.id, row.task_id, row.body, row.author, row.created_at));
  }

  async addReject(taskId: string, reason: string, author?: string | null): Promise<TaskReject> {
    const row = await DatabaseClient.insertInto("task_reject")
      .values({
        id: crypto.randomUUID(),
        task_id: taskId,
        reason: reason.trim(),
        author: author ?? null,
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return new TaskReject(row.id, row.task_id, row.reason, row.author, row.created_at);
  }

  async findRejectsByTaskId(taskId: string): Promise<TaskReject[]> {
    return this.findRejectsByTaskIds([taskId]);
  }

  async findRejectsByTaskIds(taskIds: string[]): Promise<TaskReject[]> {
    if (taskIds.length === 0) return [];
    const rows = await DatabaseClient.selectFrom("task_reject")
      .selectAll()
      .where("task_id", "in", taskIds)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((row) => new TaskReject(row.id, row.task_id, row.reason, row.author, row.created_at));
  }

  async delete(taskId: string) {
    await DatabaseClient.deleteFrom("task_reject").where("task_id", "=", taskId).execute();
    await DatabaseClient.deleteFrom("task_comment").where("task_id", "=", taskId).execute();
    await DatabaseClient.deleteFrom("task").where("id", "=", taskId).execute();
  }

  async deleteByStoryId(storyId: string) {
    const tasks = await DatabaseClient.selectFrom("task")
      .select("id")
      .where("story_id", "=", storyId)
      .execute();
    for (const task of tasks) {
      await this.delete(task.id);
    }
  }
}
