import type { FC } from "hono/jsx";
import type { ProjectAgent } from "@application/usecase/project/ListProjectAgentsUseCase.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { type TaskStatus as TaskStatusValue } from "@constants/TaskStatus.ts";
import type { Task } from "@domain/model/Task.ts";
import type { Project } from "@domain/model/Project.ts";
import type { Story } from "@domain/model/Story.ts";
import { Layout } from "./layout/Layout.tsx";
import { Button } from "./components/button.tsx";
import { StoryCard } from "./components/story-card.tsx";
import { TaskRow } from "./components/task-row.tsx";

type ProjectProps = {
  summary: {
    total: number;
    byStatus: Record<TaskStatusValue, number>;
    lastUpdatedAt: number | null;
  };
  tasks: Task[];
  stories: Story[];
  project: Project;
  agents: ProjectAgent[];
  agentSummary: {
    total: number;
    online: number;
    offline: number;
  };
};

export const ProjectPage: FC<ProjectProps> = ({
  summary,
  tasks,
  stories,
  project,
  agents,
  agentSummary,
}) => {
  const tasksByStoryId = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.storyId) continue;
    const storyTasks = tasksByStoryId.get(task.storyId) ?? [];
    storyTasks.push(task);
    tasksByStoryId.set(task.storyId, storyTasks);
  }

  const unassignedTasks = tasks.filter((task) => !task.storyId);

  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-8">
        <a
          href="/"
          className="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
        >
          ← プロジェクト一覧に戻る
        </a>
        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 shadow-sm md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-3xl flex-col gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">Project Detail</p>
              <h1 className="text-4xl font-semibold tracking-tight text-stone-900">{project.name}</h1>
              <p className="text-sm leading-7 text-stone-600">
                {project.description ?? "プロジェクトの説明はまだ設定されていません。"}
              </p>
              <p className="text-sm text-stone-500">BaseDir: {project.baseDir}</p>
              <p className="text-sm text-stone-400">
                最終更新: {new Date(project.updatedAt).toLocaleString()}
              </p>
            </div>
            <a href={`/project/${project.id}/story/add`}>
              <Button text="+ 新しいStoryを作成" />
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Agents</h2>
              <p className="text-sm text-stone-500">
                project に参加している agent と現在の接続状況
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                Online {agentSummary.online}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                Offline {agentSummary.offline}
              </span>
            </div>
          </div>
          {agents.length > 0 ? (
            <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.18em] text-stone-400">
                    <tr>
                      <th className="px-5 py-4 font-medium">Worker</th>
                      <th className="px-5 py-4 font-medium">Role</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 font-medium">Session</th>
                      <th className="px-5 py-4 font-medium">Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.membershipId} className="border-t border-stone-100 align-top">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-stone-900">{agent.workerId}</span>
                            <span className="text-xs text-stone-400">{agent.membershipId}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                            {agent.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={
                              agent.online
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
                                : "rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600"
                            }
                          >
                            {agent.online ? "online" : "offline"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-600">
                          {agent.sessionId ? (
                            <code className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-700">
                              {agent.sessionId}
                            </code>
                          ) : (
                            <span className="text-stone-400">not connected</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-600">
                          {agent.lastHeartbeatAt ? (
                            new Date(agent.lastHeartbeatAt).toLocaleString()
                          ) : (
                            <span className="text-stone-400">no heartbeat</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              この project に参加している agent はまだいません。
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Stories</h2>
            <p className="text-sm text-stone-400">{stories.length} items</p>
          </div>
          {stories.length > 0 ? (
            <div className="flex flex-col gap-3">
              {stories.map((story) => {
                const storyTasks = tasksByStoryId.get(story.id) ?? [];

                return (
                  <div
                    key={story.id}
                    className="rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <StoryCard story={story} taskCount={storyTasks.length} embedded />
                      </div>
                      {story.status === StoryStatus.TODO && (
                        <form
                          method="post"
                          action={`/project/${project.id}/story/${story.id}/delete`}
                          onsubmit={"return confirm('この Story と配下の Task を削除しますか？');"}
                        >
                          <button
                            type="submit"
                            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            削除
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="mt-5 border-l border-stone-200 pl-6">
                      {storyTasks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {storyTasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              projectId={project.id}
                              id={task.id}
                              title={task.title}
                              description={task.description}
                              status={task.status}
                              updatedAt={task.updatedAt}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-6 text-sm text-stone-500">
                          この Story にはまだ Task がありません。
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              まだ Story はありません。上のボタンから追加してください。
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Tasks Without Story</h2>
            <p className="text-sm text-stone-400">{unassignedTasks.length} tasks</p>
          </div>
          {unassignedTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {unassignedTasks.map((task) => {
                return (
                  <TaskRow
                    key={task.id}
                    projectId={project.id}
                    id={task.id}
                    title={task.title}
                    description={task.description}
                    status={task.status}
                    updatedAt={task.updatedAt}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              Story に紐づいていない Task はありません。
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
};
