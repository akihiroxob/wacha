import { Context } from "hono";
import { Index } from "@views/index.tsx";
import { ProjectPage } from "@views/project.tsx";
import { renderToString } from "hono/jsx/dom/server";
import { listTaskUseCase, listProjectUseCase, getProjectUseCase } from "@container";

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

    const result = await listTaskUseCase.execute(projectId);
    const page = ProjectPage({ project, summary: result.summary, tasks: result.tasks });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }
}

export default new PageController();
