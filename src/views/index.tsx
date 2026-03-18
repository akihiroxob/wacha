import type { FC } from "hono/jsx";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "@constants/TaskStatus.ts";
import type { Task } from "@domain/model/Task.ts";

type IndexProps = {
  summary: {
    total: number;
    byStatus: Record<TaskStatusValue, number>;
    lastUpdatedAt: number | null;
  };
  tasks: Task[];
};

const STATUS_LABELS: Record<TaskStatusValue, string> = {
  [TaskStatus.TODO]: "TODO",
  [TaskStatus.DOING]: "DOING",
  [TaskStatus.IN_REVIEW]: "IN REVIEW",
  [TaskStatus.ACCEPTED]: "ACCEPTED",
  [TaskStatus.REJECTED]: "REJECTED",
};

const STATUS_COLORS: Record<TaskStatusValue, string> = {
  [TaskStatus.TODO]: "#8b5cf6",
  [TaskStatus.DOING]: "#2563eb",
  [TaskStatus.IN_REVIEW]: "#d97706",
  [TaskStatus.ACCEPTED]: "#059669",
  [TaskStatus.REJECTED]: "#dc2626",
};

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

export const Index: FC<IndexProps> = ({ summary, tasks }) => {
  const cards = [
    { label: "Total", value: summary.total.toString(), color: "#0f172a" },
    {
      label: "Todo",
      value: summary.byStatus[TaskStatus.TODO].toString(),
      color: STATUS_COLORS[TaskStatus.TODO],
    },
    {
      label: "Doing",
      value: summary.byStatus[TaskStatus.DOING].toString(),
      color: STATUS_COLORS[TaskStatus.DOING],
    },
    {
      label: "In Review",
      value: summary.byStatus[TaskStatus.IN_REVIEW].toString(),
      color: STATUS_COLORS[TaskStatus.IN_REVIEW],
    },
    {
      label: "Accepted",
      value: summary.byStatus[TaskStatus.ACCEPTED].toString(),
      color: STATUS_COLORS[TaskStatus.ACCEPTED],
    },
    {
      label: "Rejected",
      value: summary.byStatus[TaskStatus.REJECTED].toString(),
      color: STATUS_COLORS[TaskStatus.REJECTED],
    },
  ];

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Wacha Task Board</title>
        <link rel="stylesheet" href="/styles/index.css" />
      </head>
      <body>
        <main class="shell">
          <header class="hero">
            <div>
              <h1>Task Board</h1>
              <p class="subtitle">
                MCP サーバ上のタスク状況を一覧で確認できます。最新更新順に表示しています。
              </p>
            </div>
            <div class="meta">
              <span class="meta-label">Last Updated</span>
              <div class="meta-value mono">{formatDateTime(summary.lastUpdatedAt)}</div>
            </div>
          </header>

          <section class="cards">
            {cards.map((card) => (
              <section class="card">
                <div class="card-label">{card.label}</div>
                <div class="card-value" style={{ color: card.color }}>
                  {card.value}
                </div>
              </section>
            ))}
          </section>

          <section>
            <div class="toolbar">
              <h2 class="toolbar-title">Tasks</h2>
              <a class="button" href="/">
                Refresh
              </a>
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
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td class="empty" colSpan={7}>
                        タスクはまだありません。
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr>
                        <td class="mono">{task.id}</td>
                        <td>{task.title}</td>
                        <td>{task.description ?? "-"}</td>
                        <td>
                          <span
                            class="status"
                            style={{
                              background: `${STATUS_COLORS[task.status]}1a`,
                              color: STATUS_COLORS[task.status],
                              borderColor: `${STATUS_COLORS[task.status]}33`,
                            }}
                          >
                            {STATUS_LABELS[task.status]}
                          </span>
                        </td>
                        <td>{task.assignee ?? "-"}</td>
                        <td class="mono">{formatDateTime(task.updatedAt)}</td>
                        <td class="mono">{formatDateTime(task.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
};
