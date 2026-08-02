import { Context } from "hono";
import { ValidationError } from "@application/error/ValidationError.ts";
import { NotFoundError } from "@application/error/NotFoundError.ts";
import { ProjectRole, type ProjectRole as ProjectRoleValue } from "@constants/ProjectRole.ts";
import type {
  CreateStoryResponse,
  OkResponse,
  ProjectActivityResponse,
  ProjectDetailResponse,
  ProjectListResponse,
} from "@shared/apiTypes.ts";
import {
  listTaskUseCase,
  listProjectUseCase,
  getProjectUseCase,
  listProjectGrantsUseCase,
  grantProjectRoleUseCase,
  revokeProjectRoleUseCase,
  listStoryUseCase,
  issueStoryUseCase,
  editStoryUseCase,
  editTaskUseCase,
  cancelTaskUseCase,
  deleteStoryUseCase,
  deleteTaskUseCase,
  acceptTaskUseCase,
  rejectTaskUseCase,
  listTaskCommentUseCase,
  addTaskCommentUseCase,
  getProjectActivityUseCase,
} from "@container";

export class PageController {
  private readonly assignableRoles = [
    ProjectRole.WORKER,
    ProjectRole.REVIEWER,
    ProjectRole.MANAGER,
  ] as const;

  private async readJsonBody(c: Context): Promise<Record<string, unknown>> {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ValidationError("Invalid JSON body");
    return body as Record<string, unknown>;
  }

  private readTextField(body: Record<string, unknown>, key: string): string {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
  }

  private readSortOrderField(body: Record<string, unknown>): number | null {
    const value = body["sortOrder"];
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
  }

  private readProjectRole(body: Record<string, unknown>): ProjectRoleValue {
    const role = this.readTextField(body, "role");
    if (!this.assignableRoles.includes(role as (typeof this.assignableRoles)[number])) {
      throw new ValidationError("Role must be worker, reviewer, or manager");
    }
    return role as ProjectRoleValue;
  }

  private async getProjectOrThrow(projectId: string | undefined) {
    if (!projectId) throw new ValidationError("projectId is required");
    const project = await getProjectUseCase.execute(projectId);
    if (!project) throw new NotFoundError("Project not found");
    return project;
  }

  private async findStoryInProject(projectId: string, storyId: string) {
    const storyResult = await listStoryUseCase.execute(projectId);
    return storyResult.stories.find((story) => story.id === storyId) ?? null;
  }

  private async findTaskInProject(projectId: string, taskId: string) {
    const taskResult = await listTaskUseCase.execute(projectId);
    return taskResult.tasks.find((task) => task.id === taskId) ?? null;
  }

  async index(c: Context) {
    const result = await listProjectUseCase.execute();
    const body: ProjectListResponse = { projects: result.projects };
    return c.json(body);
  }

  async project(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));

    const taskResult = await listTaskUseCase.execute(project.id);
    const commentsResult = await listTaskCommentUseCase.executeForTasks(
      taskResult.tasks.map((task) => task.id),
    );
    const storyResult = await listStoryUseCase.execute(project.id);
    const grantResult = await listProjectGrantsUseCase.execute(project.id);

    const body: ProjectDetailResponse = {
      project,
      summary: taskResult.summary,
      tasks: taskResult.tasks,
      comments: commentsResult.comments,
      stories: storyResult.stories,
      grants: grantResult.grants,
      grantSummary: grantResult.summary,
    };
    return c.json(body);
  }

  async projectActivity(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const rawLimit = c.req.query("limit") ?? "20";
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new ValidationError("limit must be an integer between 1 and 200");
    }

    const result = await getProjectActivityUseCase.execute(project.id, limit);
    const body: ProjectActivityResponse = result;
    return c.json(body);
  }

  async grantProjectRole(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const jsonBody = await this.readJsonBody(c);
    const principalId = this.readTextField(jsonBody, "principalId");
    if (principalId === "") throw new ValidationError("Agent name is required");
    const role = this.readProjectRole(jsonBody);

    await grantProjectRoleUseCase.execute(project.id, principalId, role);
    const body: OkResponse = { ok: true };
    return c.json(body, 201);
  }

  async revokeProjectRole(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const jsonBody = await this.readJsonBody(c);
    const principalId = this.readTextField(jsonBody, "principalId");
    if (principalId === "") throw new ValidationError("Agent name is required");
    const role = this.readProjectRole(jsonBody);

    await revokeProjectRoleUseCase.execute(project.id, principalId, role);
    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async createStory(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));

    const jsonBody = await this.readJsonBody(c);
    const title = this.readTextField(jsonBody, "title");
    const description = this.readTextField(jsonBody, "description");
    if (title === "") throw new ValidationError("Title は必須です。");

    const story = await issueStoryUseCase.execute(project.id, title, description || null);
    const body: CreateStoryResponse = { story };
    return c.json(body, 201);
  }

  async updateStory(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const storyId = c.req.param("storyId");
    if (!storyId) throw new ValidationError("storyId is required");

    const story = await this.findStoryInProject(project.id, storyId);
    if (!story) throw new NotFoundError("Story not found");

    const jsonBody = await this.readJsonBody(c);
    const title = this.readTextField(jsonBody, "title");
    const description = this.readTextField(jsonBody, "description");
    if (title === "") throw new ValidationError("Title は必須です。");
    const sortOrder = this.readSortOrderField(jsonBody);

    try {
      await editStoryUseCase.execute(project.id, storyId, title, description || null, sortOrder);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update story";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async moveStory(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const storyId = c.req.param("storyId");
    if (!storyId) throw new ValidationError("storyId is required");

    const jsonBody = await this.readJsonBody(c);
    const direction = jsonBody["direction"];
    if (direction !== "up" && direction !== "down") {
      throw new ValidationError("direction must be 'up' or 'down'");
    }

    // 優先順位順の一覧上で隣と位置を入れ替え、全体を連番で振り直す(MCP と同じ UseCase を使う)。
    // 単純な sortOrder 交換だと同順位の隣同士で no-op になるため、位置ベースで確定させる
    const storyResult = await listStoryUseCase.execute(project.id);
    const stories = [...storyResult.stories];
    const index = stories.findIndex((story) => story.id === storyId);
    if (index === -1) throw new NotFoundError("Story not found");

    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    const body: OkResponse = { ok: true };
    if (neighborIndex < 0 || neighborIndex >= stories.length) return c.json(body); // 端では何もしない

    [stories[index], stories[neighborIndex]] = [stories[neighborIndex]!, stories[index]!];
    for (let position = 0; position < stories.length; position++) {
      const story = stories[position]!;
      const sortOrder = position + 1;
      if (story.sortOrder !== sortOrder) {
        await editStoryUseCase.execute(
          project.id,
          story.id,
          story.title,
          story.description,
          sortOrder,
        );
      }
    }
    return c.json(body);
  }

  async updateTask(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    const task = await this.findTaskInProject(project.id, taskId);
    if (!task) throw new NotFoundError("Task not found");

    const jsonBody = await this.readJsonBody(c);
    const title = this.readTextField(jsonBody, "title");
    const description = this.readTextField(jsonBody, "description");
    if (title === "") throw new ValidationError("Title は必須です。");
    const sortOrder = this.readSortOrderField(jsonBody);

    try {
      await editTaskUseCase.execute(project.id, taskId, title, description || null, sortOrder);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async deleteStory(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const storyId = c.req.param("storyId");
    if (!storyId) throw new ValidationError("storyId is required");

    const story = await this.findStoryInProject(project.id, storyId);
    if (!story) throw new NotFoundError("Story not found");

    await deleteStoryUseCase.execute(storyId);
    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async deleteTask(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    const task = await this.findTaskInProject(project.id, taskId);
    if (!task) throw new NotFoundError("Task not found");

    await deleteTaskUseCase.execute(taskId);
    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async acceptTask(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    try {
      await acceptTaskUseCase.execute(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept task";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async rejectTask(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    const jsonBody = await this.readJsonBody(c);
    const reason = this.readTextField(jsonBody, "reason");
    if (reason === "") throw new ValidationError("Reject reason is required");

    try {
      await rejectTaskUseCase.execute(taskId, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject task";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async cancelTask(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    const jsonBody = await this.readJsonBody(c);
    const reason = this.readTextField(jsonBody, "reason");
    if (reason === "") throw new ValidationError("Cancel reason is required");

    try {
      await cancelTaskUseCase.execute(taskId, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel task";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
    return c.json(body);
  }

  async addTaskComment(c: Context) {
    const project = await this.getProjectOrThrow(c.req.param("projectId"));
    const taskId = c.req.param("taskId");
    if (!taskId) throw new ValidationError("taskId is required");

    const jsonBody = await this.readJsonBody(c);
    const commentBody = this.readTextField(jsonBody, "body");
    if (commentBody === "") throw new ValidationError("Comment body is required");
    const author = this.readTextField(jsonBody, "author");

    await addTaskCommentUseCase.execute(taskId, commentBody, author || null);
    const body: OkResponse = { ok: true };
    return c.json(body, 201);
  }
}

export default new PageController();
