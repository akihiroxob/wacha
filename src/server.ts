import "@bootstrap/loadEnv.ts";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { RequestMethod } from "@constants/RequestMethod.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import * as container from "container.ts";

await initializeSchema();

const app = new Hono();

const ROLE_PERMISSIONS: Record<string, RequestMethod[]> = {
  manager: [RequestMethod.TASK_LIST, RequestMethod.TASK_ISSUE],
  worker: [RequestMethod.TASK_LIST, RequestMethod.TASK_CLAIM, RequestMethod.TASK_COMPLETE],
  reviewer: [RequestMethod.TASK_LIST, RequestMethod.TASK_ACCEPT, RequestMethod.TASK_REJECT],
  viewer: [RequestMethod.TASK_LIST],
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "TODO",
  [TaskStatus.DOING]: "DOING",
  [TaskStatus.IN_REVIEW]: "IN REVIEW",
  [TaskStatus.ACCEPTED]: "ACCEPTED",
  [TaskStatus.REJECTED]: "REJECTED",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "#8b5cf6",
  [TaskStatus.DOING]: "#2563eb",
  [TaskStatus.IN_REVIEW]: "#d97706",
  [TaskStatus.ACCEPTED]: "#059669",
  [TaskStatus.REJECTED]: "#dc2626",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

app.get("/", async (c) => {
  const result = await container.listTaskUseCase.execute();
  const cards = [
    { label: "Total", value: result.summary.total.toString(), color: "#0f172a" },
    {
      label: "Todo",
      value: result.summary.byStatus[TaskStatus.TODO].toString(),
      color: STATUS_COLORS[TaskStatus.TODO],
    },
    {
      label: "Doing",
      value: result.summary.byStatus[TaskStatus.DOING].toString(),
      color: STATUS_COLORS[TaskStatus.DOING],
    },
    {
      label: "In Review",
      value: result.summary.byStatus[TaskStatus.IN_REVIEW].toString(),
      color: STATUS_COLORS[TaskStatus.IN_REVIEW],
    },
    {
      label: "Accepted",
      value: result.summary.byStatus[TaskStatus.ACCEPTED].toString(),
      color: STATUS_COLORS[TaskStatus.ACCEPTED],
    },
    {
      label: "Rejected",
      value: result.summary.byStatus[TaskStatus.REJECTED].toString(),
      color: STATUS_COLORS[TaskStatus.REJECTED],
    },
  ];

  const cardsHtml = cards
    .map(
      (card) => `
        <section class="card">
          <div class="card-label">${card.label}</div>
          <div class="card-value" style="color: ${card.color}">${card.value}</div>
        </section>
      `,
    )
    .join("");

  const rowsHtml =
    result.tasks.length === 0
      ? `
        <tr>
          <td class="empty" colspan="7">タスクはまだありません。</td>
        </tr>
      `
      : result.tasks
          .map(
            (task) => `
              <tr>
                <td class="mono">${escapeHtml(task.id)}</td>
                <td>${escapeHtml(task.title)}</td>
                <td>${task.description ? escapeHtml(task.description) : "-"}</td>
                <td>
                  <span class="status" style="background:${STATUS_COLORS[task.status]}1a;color:${STATUS_COLORS[task.status]};border-color:${STATUS_COLORS[task.status]}33;">
                    ${STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td>${task.assignee ? escapeHtml(task.assignee) : "-"}</td>
                <td class="mono">${formatDateTime(task.updatedAt)}</td>
                <td class="mono">${formatDateTime(task.createdAt)}</td>
              </tr>
            `,
          )
          .join("");

  return c.html(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wacha Task Board</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe5;
        --panel: rgba(255, 252, 245, 0.86);
        --line: rgba(15, 23, 42, 0.12);
        --text: #172033;
        --muted: #5f6c80;
        --accent: #c2410c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(194, 65, 12, 0.18), transparent 28%),
          radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 24%),
          linear-gradient(180deg, #fbf8f1 0%, var(--bg) 100%);
      }
      .shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px 56px;
      }
      .hero {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5vw, 4.4rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      .subtitle {
        margin: 10px 0 0;
        max-width: 720px;
        color: var(--muted);
        font-size: 1rem;
      }
      .meta {
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--panel);
        backdrop-filter: blur(14px);
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
      }
      .meta-label {
        display: block;
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .meta-value {
        margin-top: 4px;
        font-size: 1rem;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 14px;
        margin-bottom: 24px;
      }
      .card {
        padding: 16px 18px;
        border-radius: 18px;
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
      }
      .card-label {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .card-value {
        margin-top: 8px;
        font-size: 2rem;
        line-height: 1;
      }
      .table-wrap {
        overflow-x: auto;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 860px;
      }
      th, td {
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      tr:last-child td {
        border-bottom: none;
      }
      .status {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      .mono {
        font-family: "SFMono-Regular", "Menlo", "Monaco", monospace;
        font-size: 0.85rem;
      }
      .empty {
        color: var(--muted);
        text-align: center;
        padding: 42px 18px;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin: 0 0 14px;
      }
      .toolbar-title {
        font-size: 1.05rem;
        margin: 0;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(194, 65, 12, 0.22);
        background: rgba(194, 65, 12, 0.08);
        color: var(--accent);
        text-decoration: none;
        font-weight: 700;
      }
      @media (max-width: 720px) {
        .shell {
          padding-top: 28px;
        }
        h1 {
          font-size: 2.6rem;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <div>
          <h1>Task Board</h1>
          <p class="subtitle">MCP サーバ上のタスク状況を一覧で確認できます。最新更新順に表示しています。</p>
        </div>
        <div class="meta">
          <span class="meta-label">Last Updated</span>
          <div class="meta-value mono">${formatDateTime(result.summary.lastUpdatedAt)}</div>
        </div>
      </header>

      <section class="cards">${cardsHtml}</section>

      <section>
        <div class="toolbar">
          <h2 class="toolbar-title">Tasks</h2>
          <a class="button" href="/">Refresh</a>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Updated</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </section>
    </main>
  </body>
</html>`);
});

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
        description: z.string().nullable().optional(),
        projectId: z.string(),
        storyId: z.string().optional(),
      });
      const { title, description, projectId, storyId } = schema.parse(params);

      const task = await container.issueTaskUseCase.execute(
        title,
        description ?? null,
        projectId,
        storyId,
      );
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

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
  },
  (info) => {
    console.log(`Server running at http://${info.address}:${info.port}`);
  },
);
