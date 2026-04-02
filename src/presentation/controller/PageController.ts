import { Context } from "hono";
import { pushNotifier } from "@mcp/pushNotifier.ts";
import { Index } from "@views/index.tsx";
import { ProjectPage } from "@views/project.tsx";
import { AddStoryPage } from "@views/add-story.tsx";
import { renderToString } from "hono/jsx/dom/server";
import {
  listTaskUseCase,
  listProjectUseCase,
  getProjectUseCase,
  listStoryUseCase,
  issueStoryUseCase,
  deleteStoryUseCase,
  deleteTaskUseCase,
} from "@container";

export class PageController {
  async index(c: Context) {
    const result = await listProjectUseCase.execute();
    const page = Index({ projects: result.projects });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async project(c: Context) {
    const projectId = c.req.param("projectId");

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const project = await getProjectUseCase.execute(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const taskResult = await listTaskUseCase.execute(projectId);
    const storyResult = await listStoryUseCase.execute(projectId);
    const page = ProjectPage({
      project,
      summary: taskResult.summary,
      tasks: taskResult.tasks,
      stories: storyResult.stories,
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
    await pushNotifier.notifyManagersStoryCreated(story);
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
}

export default new PageController();
