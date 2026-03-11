import "@bootstrap/loadEnv.ts";
import { Hono } from "hono";
import { z } from "zod";
import { RequestMethod } from "@constants/RequestMethod.ts";
import * as container from "container.ts";

const app = new Hono();

const ROLE_PERMISSIONS: Record<string, RequestMethod[]> = {
  manager: [RequestMethod.TASK_LIST, RequestMethod.TASK_ISSUE],
  worker: [RequestMethod.TASK_LIST, RequestMethod.TASK_CLAIM, RequestMethod.TASK_COMPLETE],
  reviewer: [RequestMethod.TASK_LIST, RequestMethod.TASK_ACCEPT, RequestMethod.TASK_REJECT],
  viewer: [RequestMethod.TASK_LIST],
};

app.post("/mcp", async (c) => {
  const role = c.req.header("x-role") ?? "watcher";

  const body = await c.req.json();
  const { method, params } = body;

  if (!ROLE_PERMISSIONS[role]?.includes(method)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  switch (method) {
    case RequestMethod.TASK_LIST: {
      const tasks = await container.listTaskUseCase.execute();
      return c.json({ result: tasks });
    }

    case RequestMethod.TASK_ISSUE: {
      const schema = z.object({
        title: z.string(),
        description: z.string().optional(),
      });
      const { title, description } = schema.parse(params);

      const task = await container.issueTaskUseCase.execute(title, description);
      return c.json({ result: task });
    }

    case RequestMethod.TASK_CLAIM: {
      const schema = z.object({
        taskId: z.string(),
        workerId: z.string(),
      });
      const { taskId, workerId } = schema.parse(params);

      const task = await container.claimTaskUseCase.execute(taskId, workerId);
      return c.json({ result: "claimed" });
    }

    case RequestMethod.TASK_COMPLETE: {
      const schema = z.object({
        taskId: z.string(),
      });
      const { taskId } = schema.parse(params);
      const task = await container.completeTaskUseCase.execute(taskId);
      return c.json({ result: "completed" });
    }

    case RequestMethod.TASK_ACCEPT: {
      const schema = z.object({
        taskId: z.string(),
      });
      const { taskId } = schema.parse(params);
      const task = await container.acceptTaskUseCase.execute(taskId);
      return c.json({ result: "accepted" });
    }

    case RequestMethod.TASK_REJECT: {
      const schema = z.object({
        taskId: z.string(),
      });
      const { taskId } = schema.parse(params);
      const task = await container.rejectTaskUseCase.execute(taskId);
      return c.json({ result: "rejected" });
    }

    default:
      return c.json({ error: "Unknown method" }, 400);
  }
});
