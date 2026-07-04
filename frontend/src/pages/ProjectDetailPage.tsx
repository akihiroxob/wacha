import { Link, useParams, useSearchParams } from "react-router-dom";
import type { StoryDto, TaskDto, TaskCommentDto, TaskStatus } from "@shared/apiTypes";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { StoryCard } from "@/components/StoryCard";
import { TaskRow } from "@/components/TaskRow";
import { useDeleteStory, useProject } from "@/lib/queries";
import { ApiError } from "@/lib/api";

const isActiveStoryStatus = (status: StoryDto["status"]) =>
  status !== "done" && status !== "canceled";

const isActiveTask = (status: TaskStatus) =>
  status !== "accepted" && status !== "rejected" && status !== "canceled";

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const storyStatusFilter = searchParams.get("storyStatus") === "all" ? "all" : "active";
  const { data, isPending, error } = useProject(projectId);
  const deleteStory = useDeleteStory(projectId);

  const storyStatusOptions: { label: string; value: "all" | "active" }[] = [
    { label: "Done / Canceled 以外", value: "active" },
    { label: "すべて表示", value: "all" },
  ];

  if (isPending) {
    return (
      <Layout>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-8">
          <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
            読み込み中...
          </div>
        </main>
      </Layout>
    );
  }

  if (error || !data) {
    const message =
      error instanceof ApiError && error.status === 404
        ? "Project が見つかりません。"
        : (error?.message ?? "読み込みに失敗しました。");
    return (
      <Layout>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-8">
          <Link
            to="/"
            className="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
          >
            ← プロジェクト一覧に戻る
          </Link>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        </main>
      </Layout>
    );
  }

  const { project, tasks, comments, agents } = data;

  const stories =
    storyStatusFilter === "all"
      ? data.stories
      : data.stories.filter((story) => isActiveStoryStatus(story.status));

  const tasksByStoryId = new Map<string, TaskDto[]>();
  const commentsByTaskId = new Map<string, TaskCommentDto[]>();

  for (const task of tasks) {
    if (!task.storyId) continue;
    const storyTasks = tasksByStoryId.get(task.storyId) ?? [];
    storyTasks.push(task);
    tasksByStoryId.set(task.storyId, storyTasks);
  }
  for (const comment of comments) {
    const taskComments = commentsByTaskId.get(comment.taskId) ?? [];
    taskComments.push(comment);
    commentsByTaskId.set(comment.taskId, taskComments);
  }

  const unassignedTasks = tasks.filter((task) =>
    storyStatusFilter === "all" ? !task.storyId : !task.storyId && isActiveTask(task.status),
  );

  const handleDeleteStory = (storyId: string) => {
    if (!confirm("この Story と配下の Task を削除しますか？")) return;
    deleteStory.mutate(storyId);
  };

  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-8">
        <Link
          to="/"
          className="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
        >
          ← プロジェクト一覧に戻る
        </Link>
        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 shadow-sm md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-3xl flex-col gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">
                Project Detail
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
                {project.name}
              </h1>
              <p className="text-sm leading-7 text-stone-600">
                {project.description ?? "プロジェクトの説明はまだ設定されていません。"}
              </p>
              <p className="text-sm text-stone-500">BaseDir: {project.baseDir}</p>
              <p className="text-sm text-stone-400">
                最終更新: {new Date(project.updatedAt).toLocaleString()}
              </p>
            </div>
            <Link to={`/project/${project.id}/story/add`}>
              <Button text="+ 新しいStoryを作成" />
            </Link>
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
          </div>
          {agents.length > 0 ? (
            <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.18em] text-stone-400">
                    <tr>
                      <th className="px-5 py-4 font-medium">Worker</th>
                      <th className="px-5 py-4 font-medium">Role</th>
                      <th className="px-5 py-4 font-medium">Session</th>
                      <th className="px-5 py-4 font-medium">Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.id} className="border-t border-stone-100 align-top">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-stone-900">{agent.sessionId}</span>
                            <span className="text-xs text-stone-400">{agent.id}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                            {agent.role}
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Stories</h2>
              <p className="text-sm text-stone-500">Story 単位で状態を絞り込みできます</p>
            </div>
            <label className="flex flex-col gap-2 text-sm text-stone-600">
              <span className="font-medium">Story Status</span>
              <select
                value={storyStatusFilter}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSearchParams(value === "all" ? { storyStatus: "all" } : {});
                }}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400"
              >
                {storyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-stone-400">{stories.length} items</p>
          </div>
          {stories.length > 0 ? (
            <div className="flex flex-col gap-3">
              {stories.map((story) => {
                const storyTasks = tasksByStoryId.get(story.id) ?? [];

                return (
                  <details
                    key={story.id}
                    name="story-accordion"
                    data-story-id={story.id}
                    className="group rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:content-none">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                            {storyTasks.length} tasks
                          </div>
                          {story.status === "todo" && (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                              Todo
                            </span>
                          )}
                          {story.status === "doing" && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              Doing
                            </span>
                          )}
                          {story.status === "done" && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Done
                            </span>
                          )}
                          {story.status === "canceled" && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                              Canceled
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-stone-900">{story.title}</h3>
                          <span className="text-xs text-stone-400">{story.id}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 transition group-open:rotate-180">
                        ↓
                      </span>
                    </summary>
                    <div className="mt-5 border-l border-stone-200 pl-6">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <StoryCard story={story} taskCount={storyTasks.length} embedded />
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          <Link
                            to={`/project/${project.id}/story/${story.id}/edit`}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                          >
                            編集
                          </Link>
                          {(story.status === "todo" || story.status === "canceled") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStory(story.id)}
                              disabled={deleteStory.isPending}
                              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-5">
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
                                rejectReason={task.rejectReason}
                                comments={commentsByTaskId.get(task.id) ?? []}
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
                  </details>
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
              {unassignedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  projectId={project.id}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  status={task.status}
                  rejectReason={task.rejectReason}
                  comments={commentsByTaskId.get(task.id) ?? []}
                  updatedAt={task.updatedAt}
                />
              ))}
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
