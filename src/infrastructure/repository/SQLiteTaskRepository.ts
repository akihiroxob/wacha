import { Task } from "@domain/model/Task.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";
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
          row.sort_order,
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
          row.sort_order,
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
      row.sort_order,
    );
  }

  async create(title: string, description: string | null, projectId: string, storyId?: string) {
    const id = crypto.randomUUID();
    const now = Date.now();

    // 既定は末尾(プロジェクト内の最大 sort_order + 1)
    const maxRow = await DatabaseClient.selectFrom("task")
      .select(({ fn }) => fn.max("sort_order").as("max_sort_order"))
      .where("project_id", "=", projectId)
      .executeTakeFirst();
    const sortOrder = (maxRow?.max_sort_order ?? 0) + 1;

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
        sort_order: sortOrder,
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
      task.sort_order,
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
        sort_order: task.sortOrder,
        updated_at: Date.now(),
      })
      .where("id", "=", task.id)
      .execute();
  }

  async addComment(
    taskId: string,
    body: string,
    author?: string | null,
    sessionId?: string | null,
  ): Promise<TaskComment> {
    const row = await DatabaseClient.insertInto("task_comment")
      .values({
        id: crypto.randomUUID(),
        task_id: taskId,
        body: body.trim(),
        author: author ?? null,
        session_id: sessionId ?? null,
        created_at: Date.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return new TaskComment(row.id, row.task_id, row.body, row.author, row.created_at, row.session_id);
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
    return rows.map(
      (row) =>
        new TaskComment(row.id, row.task_id, row.body, row.author, row.created_at, row.session_id),
    );
  }

  async delete(taskId: string) {
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
