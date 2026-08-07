import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import type {
  ProjectGrantDto,
  StoryDto,
  TaskDto,
  TaskCommentDto,
  TaskStatus,
  TaskSummary,
} from "@shared/apiTypes";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { StoryCard } from "@/components/StoryCard";
import { TaskCard } from "@/components/TaskCard";
import { TaskDrawer } from "@/components/TaskDrawer";
import { RoleGrantDrawer } from "@/components/RoleGrantDrawer";
import { ProjectActivityLog, ProjectClaims } from "@/components/ProjectActivity";
import {
  useDeleteStory,
  useMoveStory,
  useProject,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";

const isActiveStoryStatus = (status: StoryDto["status"]) =>
  status !== "done" && status !== "canceled";

const isActiveTask = (status: TaskStatus) =>
  status !== "accepted" && status !== "rejected" && status !== "canceled";

const STATUS_CHIPS: { status: TaskStatus; label: string; dotClass: string }[] = [
  { status: "todo", label: "Todo", dotClass: "bg-stone-400" },
  { status: "doing", label: "Doing", dotClass: "bg-blue-500" },
  { status: "in_review", label: "InReview", dotClass: "bg-purple-500" },
  { status: "wait_accept", label: "WaitAccept", dotClass: "bg-amber-500" },
  { status: "rejected", label: "Rejected", dotClass: "bg-red-500" },
  { status: "accepted", label: "Accepted", dotClass: "bg-green-500" },
  { status: "canceled", label: "Canceled", dotClass: "bg-stone-300" },
];

const StatusSummaryChips = ({ summary }: { summary: TaskSummary }) => {
  const chips = STATUS_CHIPS.filter((chip) => summary.byStatus[chip.status] > 0);
  if (chips.length === 0) {
    return <p className="text-sm text-stone-400">Task はまだありません。</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.status}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600"
        >
          <span className={clsx("h-2 w-2 rounded-full", chip.dotClass)} />
          {chip.label}
          <span className="font-semibold text-stone-900">{summary.byStatus[chip.status]}</span>
        </span>
      ))}
      <span className="text-xs text-stone-400">全 {summary.total} tasks</span>
    </div>
  );
};

const RoleGrantChips = ({ grants }: { grants: ProjectGrantDto[] }) => {
  if (grants.length === 0) {
    return <p className="text-sm text-stone-400">Role Grant はありません。</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {grants.map((grant) => (
        <span
          key={grant.id}
          title={`${grant.principalId}\ngranted: ${formatAbsoluteTime(grant.createdAt)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600"
        >
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="font-medium text-stone-800">{grant.role}</span>
          <code className="text-[11px] text-stone-400">{grant.principalId}</code>
        </span>
      ))}
    </div>
  );
};

const SectionHeading = ({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count?: number;
}) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {description && <p className="text-sm text-stone-500">{description}</p>}
    </div>
    {count !== undefined && <p className="text-sm text-stone-400">{count} tasks</p>}
  </div>
);

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const storyStatusFilter = searchParams.get("storyStatus") === "all" ? "all" : "active";
  const activeView = searchParams.get("view") === "activity" ? "activity" : "board";
  const { data, isPending, error } = useProject(projectId);
  const deleteStory = useDeleteStory(projectId);
  const moveStory = useMoveStory(projectId);
  const [isRoleGrantDrawerOpen, setIsRoleGrantDrawerOpen] = useState(false);

  if (isPending) {
    return (
      <Layout>
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">
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
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">
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

  const { project, tasks, comments, grants, summary } = data;

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

  // PdM の判断待ち (レビュー / 受入)
  const reviewQueue = tasks.filter(
    (task) => task.status === "in_review" || task.status === "wait_accept",
  );
  // Worker の再着手待ち
  const rejectedTasks = tasks.filter((task) => task.status === "rejected");
  // Agent が作業中
  const workingTasks = tasks.filter((task) => task.status === "doing");

  const unassignedTasks = tasks.filter((task) =>
    storyStatusFilter === "all" ? !task.storyId : !task.storyId && isActiveTask(task.status),
  );

  const handleDeleteStory = (storyId: string, storyTitle: string, taskCount: number) => {
    if (
      !confirm(
        `Story「${storyTitle}」を完全に削除します。\n配下のTask ${taskCount}件も削除されます。\nこの操作は取り消せません。続行しますか？`,
      )
    ) {
      return;
    }
    deleteStory.mutate(storyId, {
      onError: (error) => alert(`Storyの削除に失敗しました。\n${error.message}`),
    });
  };

  // ドロワーの開閉は ?task=<id> で管理する (deep link 可能)
  const selectedTaskId = searchParams.get("task");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const setSelectedTask = (taskId: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (taskId) next.set("task", taskId);
        else next.delete("task");
        return next;
      },
      { replace: true },
    );
  };

  const renderTaskRow = (task: TaskDto, highlight = false) => (
    <TaskCard
      key={task.id}
      projectId={project.id}
      task={task}
      highlight={highlight}
      onOpen={(taskId) => setSelectedTask(taskId)}
    />
  );

  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">
        <Link
          to="/"
          className="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
        >
          ← プロジェクト一覧に戻る
        </Link>

        {/* プロジェクトヘッダ */}
        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-7 shadow-sm md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 max-w-3xl flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
                Project
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm leading-7 text-stone-600">{project.description}</p>
              )}
              <p className="text-xs text-stone-400">
                {project.baseDir} ・ 最終更新{" "}
                <span title={summary.lastUpdatedAt ? formatAbsoluteTime(summary.lastUpdatedAt) : ""}>
                  {summary.lastUpdatedAt ? formatRelativeTime(summary.lastUpdatedAt) : "-"}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsRoleGrantDrawerOpen(true)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Roleを管理
              </button>
              <Link to={`/project/${project.id}/story/add`}>
                <Button text="+ 新しいStoryを作成" />
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4">
            <StatusSummaryChips summary={summary} />
            <RoleGrantChips grants={grants} />
          </div>
        </section>

        <nav
          aria-label="プロジェクト表示"
          className="flex gap-1 border-b border-stone-200"
        >
          {(
            [
              { value: "board", label: "ボード" },
              { value: "activity", label: "アクティビティ" },
            ] as const
          ).map((view) => (
            <button
              key={view.value}
              type="button"
              onClick={() =>
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    if (view.value === "activity") next.set("view", "activity");
                    else next.delete("view");
                    return next;
                  },
                  { replace: true },
                )
              }
              className={clsx(
                "border-b-2 px-4 py-3 text-sm font-medium transition",
                activeView === view.value
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-stone-500 hover:text-stone-800",
              )}
            >
              {view.label}
            </button>
          ))}
        </nav>

        {activeView === "activity" ? (
          <ProjectActivityLog
            projectId={project.id}
            taskIds={new Set(tasks.map((task) => task.id))}
            onOpenTask={(taskId) => setSelectedTask(taskId)}
          />
        ) : (
          <>

        <ProjectClaims
          projectId={project.id}
          onOpenTask={(taskId) => setSelectedTask(taskId)}
        />

        {/* 要対応: PdM の判断待ち */}
        {(reviewQueue.length > 0 || rejectedTasks.length > 0) && (
          <section className="flex flex-col gap-4">
            <SectionHeading
              title="要対応"
              description="あなたの確認・判断を待っている Task"
              count={reviewQueue.length}
            />
            {reviewQueue.length > 0 && (
              <div className="flex flex-col gap-2">
                {reviewQueue.map((task) => renderTaskRow(task, true))}
              </div>
            )}
            {rejectedTasks.length > 0 && (
              <details className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-stone-600">
                  差し戻し済み (Worker の再着手待ち) — {rejectedTasks.length} tasks
                </summary>
                <div className="mt-3 flex flex-col gap-2">
                  {rejectedTasks.map((task) => renderTaskRow(task))}
                </div>
              </details>
            )}
          </section>
        )}

        {/* 進行中 */}
        {workingTasks.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeading
              title="進行中"
              description="Agent が現在作業している Task"
              count={workingTasks.length}
            />
            <div className="flex flex-col gap-2">
              {workingTasks.map((task) => renderTaskRow(task))}
            </div>
          </section>
        )}

        {/* Stories */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Stories</h2>
              <p className="text-sm text-stone-500">{stories.length} items</p>
            </div>
            <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
              {(
                [
                  { value: "active", label: "進行中" },
                  { value: "all", label: "すべて" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (option.value === "all") next.set("storyStatus", "all");
                        else next.delete("storyStatus");
                        return next;
                      },
                      { replace: true },
                    )
                  }
                  className={clsx(
                    "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
                    storyStatusFilter === option.value
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {stories.length > 0 ? (
            <div className="flex flex-col gap-3">
              {stories.map((story) => {
                const storyTasks = tasksByStoryId.get(story.id) ?? [];
                const acceptedCount = storyTasks.filter(
                  (task) => task.status === "accepted",
                ).length;

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
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                            {acceptedCount}/{storyTasks.length} tasks
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-stone-900">{story.title}</h3>
                          <span className="hidden text-xs text-stone-400 md:inline">
                            {story.id}
                          </span>
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
                          <button
                            type="button"
                            aria-label="優先順位を上げる"
                            onClick={() => moveStory.mutate({ storyId: story.id, direction: "up" })}
                            disabled={moveStory.isPending}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label="優先順位を下げる"
                            onClick={() =>
                              moveStory.mutate({ storyId: story.id, direction: "down" })
                            }
                            disabled={moveStory.isPending}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                          >
                            ↓
                          </button>
                          <Link
                            to={`/project/${project.id}/story/${story.id}/edit`}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                          >
                            編集
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteStory(story.id, story.title, storyTasks.length)
                            }
                            disabled={deleteStory.isPending}
                            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="mt-5">
                        {storyTasks.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {storyTasks.map((task) => renderTaskRow(task))}
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

        {/* Story に紐づかない Task */}
        <section className="flex flex-col gap-4">
          <SectionHeading title="Tasks Without Story" count={unassignedTasks.length} />
          {unassignedTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {unassignedTasks.map((task) => renderTaskRow(task))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              Story に紐づいていない Task はありません。
            </div>
          )}
        </section>
          </>
        )}

        {selectedTask && (
          <TaskDrawer
            projectId={project.id}
            task={selectedTask}
            comments={commentsByTaskId.get(selectedTask.id) ?? []}
            onClose={() => setSelectedTask(null)}
          />
        )}
        {isRoleGrantDrawerOpen && (
          <RoleGrantDrawer
            projectId={project.id}
            projectName={project.name}
            grants={grants}
            onClose={() => setIsRoleGrantDrawerOpen(false)}
          />
        )}
      </main>
    </Layout>
  );
};
