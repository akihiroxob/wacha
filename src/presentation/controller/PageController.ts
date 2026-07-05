import { Context } from "hono";
import { ValidationError } from "@application/error/ValidationError.ts";
import { NotFoundError } from "@application/error/NotFoundError.ts";
import type {
  CreateStoryResponse,
  OkResponse,
  ProjectDetailResponse,
  ProjectListResponse,
} from "@shared/apiTypes.ts";
import {
  listTaskUseCase,
  listProjectUseCase,
  getProjectUseCase,
  listProjectAgentsUseCase,
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
} from "@container";

export class PageController {
  private async readJsonBody(c: Context): Promise<Record<string, unknown>> {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ValidationError("Invalid JSON body");
    return body as Record<string, unknown>;
  }

  private readTextField(body: Record<string, unknown>, key: string): string {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
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
    const agentResult = await listProjectAgentsUseCase.execute(project.id);

    const body: ProjectDetailResponse = {
      project,
      summary: taskResult.summary,
      tasks: taskResult.tasks,
      comments: commentsResult.comments,
      stories: storyResult.stories,
      agents: agentResult.agents,
      agentSummary: agentResult.summary,
    };
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

    try {
      await editStoryUseCase.execute(project.id, storyId, title, description || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update story";
      throw new ValidationError(message);
    }

    const body: OkResponse = { ok: true };
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

    try {
      await editTaskUseCase.execute(project.id, taskId, title, description || null);
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
