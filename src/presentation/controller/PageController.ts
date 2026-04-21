import { Context } from "hono";
import { Index } from "@views/index.tsx";
import { ProjectPage } from "@views/project.tsx";
import { AddStoryPage } from "@views/add-story.tsx";
import { EditStoryPage } from "@views/edit-story.tsx";
import { renderToString } from "hono/jsx/dom/server";
import { ValidationError } from "@application/error/ValidationError.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import {
  listTaskUseCase,
  listProjectUseCase,
  getProjectUseCase,
  listProjectAgentsUseCase,
  listStoryUseCase,
  issueStoryUseCase,
  editStoryUseCase,
  deleteStoryUseCase,
  deleteTaskUseCase,
  acceptTaskUseCase,
  rejectTaskUseCase,
  listTaskRejectUseCase,
  listTaskCommentUseCase,
  addTaskCommentUseCase,
} from "@container";

export class PageController {
  private async findStoryInProject(projectId: string, storyId: string) {
    const storyResult = await listStoryUseCase.execute(projectId);
    return storyResult.stories.find((story) => story.id === storyId) ?? null;
  }

  async index(c: Context) {
    const result = await listProjectUseCase.execute();
    const page = Index({ projects: result.projects });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async project(c: Context) {
    const projectId = c.req.param("projectId");
    const storyStatus = c.req.query("storyStatus");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const storyStatusFilter =
      storyStatus &&
      Object.values(StoryStatus).includes(
        storyStatus as (typeof StoryStatus)[keyof typeof StoryStatus],
      )
        ? (storyStatus as (typeof StoryStatus)[keyof typeof StoryStatus])
        : "all";

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const taskResult = await listTaskUseCase.execute(projectId);
    const commentsResult = await listTaskCommentUseCase.executeForTasks(
      taskResult.tasks.map((task) => task.id),
    );
    const rejectsResult = await listTaskRejectUseCase.executeForTasks(
      taskResult.tasks.map((task) => task.id),
    );
    const storyResult = await listStoryUseCase.execute(
      projectId,
      storyStatusFilter === "all" ? undefined : storyStatusFilter,
    );
    const agentResult = await listProjectAgentsUseCase.execute(projectId);
    const page = ProjectPage({
      project,
      summary: taskResult.summary,
      tasks: taskResult.tasks,
      comments: commentsResult.comments,
      taskRejects: rejectsResult.rejects,
      stories: storyResult.stories,
      agents: agentResult.agents,
      agentSummary: agentResult.summary,
      storyStatusFilter,
    });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async addStory(c: Context) {
    const projectId = c.req.param("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const page = AddStoryPage({ project });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async editStory(c: Context) {
    const projectId = c.req.param("projectId");
    const storyId = c.req.param("storyId");

    if (!projectId || !storyId) {
      return c.json({ error: "projectId and storyId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const story = await this.findStoryInProject(projectId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const page = EditStoryPage({ project, story });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async createStory(c: Context) {
    const projectId = c.req.param("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const formData = await c.req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (title === "") {
      const page = AddStoryPage({
        project,
        error: "Title は必須です。",
        values: { title, description },
      });
      return c.html(`<!doctype html>${renderToString(page ?? "")}`, 400);
    }

    const story = await issueStoryUseCase.execute(projectId, title, description || null);
    return c.redirect(`/project/${projectId}`, 303);
  }

  async updateStory(c: Context) {
    const projectId = c.req.param("projectId");
    const storyId = c.req.param("storyId");

    if (!projectId || !storyId) {
      return c.json({ error: "projectId and storyId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const story = await this.findStoryInProject(projectId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const formData = await c.req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (title === "") {
      const page = EditStoryPage({
        project,
        story,
        error: "Title は必須です。",
        values: { title, description },
      });
      return c.html(`<!doctype html>${renderToString(page ?? "")}`, 400);
    }

    try {
      await editStoryUseCase.execute(projectId, storyId, title, description || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update story";
      const page = EditStoryPage({
        project,
        story,
        error: message,
        values: { title, description },
      });
      return c.html(`<!doctype html>${renderToString(page ?? "")}`, 400);
    }

    return c.redirect(`/project/${projectId}`, 303);
  }

  async deleteStory(c: Context) {
    const projectId = c.req.param("projectId");
    const storyId = c.req.param("storyId");

    if (!projectId || !storyId) {
      return c.json({ error: "projectId and storyId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    await deleteStoryUseCase.execute(storyId);
    return c.redirect(`/project/${projectId}`, 303);
  }

  async deleteTask(c: Context) {
    const projectId = c.req.param("projectId");
    const taskId = c.req.param("taskId");

    if (!projectId || !taskId) {
      return c.json({ error: "projectId and taskId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    await deleteTaskUseCase.execute(taskId);
    return c.redirect(`/project/${projectId}`, 303);
  }

  async acceptTask(c: Context) {
    const projectId = c.req.param("projectId");
    const taskId = c.req.param("taskId");

    if (!projectId || !taskId) {
      return c.json({ error: "projectId and taskId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    try {
      await acceptTaskUseCase.execute(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept task";
      throw new ValidationError(message);
    }

    return c.redirect(`/project/${projectId}`, 303);
  }

  async rejectTask(c: Context) {
    const projectId = c.req.param("projectId");
    const taskId = c.req.param("taskId");

    if (!projectId || !taskId) {
      return c.json({ error: "projectId and taskId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const formData = await c.req.formData();
    const reason = String(formData.get("reason") ?? "").trim();

    if (reason === "") {
      throw new ValidationError("Reject reason is required");
    }

    try {
      await rejectTaskUseCase.execute(taskId, reason, "human");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject task";
      throw new ValidationError(message);
    }

    return c.redirect(`/project/${projectId}`, 303);
  }

  async addTaskComment(c: Context) {
    const projectId = c.req.param("projectId");
    const taskId = c.req.param("taskId");

    if (!projectId || !taskId) {
      return c.json({ error: "projectId and taskId are required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const formData = await c.req.formData();
    const body = String(formData.get("body") ?? "").trim();
    if (body === "") throw new ValidationError("Comment body is required");

    await addTaskCommentUseCase.execute(taskId, body, "human");
    return c.redirect(`/project/${projectId}`, 303);
  }
}

export default new PageController();
