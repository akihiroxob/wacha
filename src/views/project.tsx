import type { FC } from "hono/jsx";
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
};

export const ProjectPage: FC<ProjectProps> = ({ summary, tasks, stories, project }) => {
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Stories</h2>
            <p className="text-sm text-stone-400">{stories.length} items</p>
          </div>
          {stories.length > 0 ? (
            <div className="flex flex-col gap-3">
              {stories.map((story) => {
                const storyTasks = tasksByStoryId.get(story.id) ?? [];

                return (
                  <details
                    key={story.id}
                    className="group rounded-[2rem] border border-stone-200 bg-white px-6 py-5 shadow-sm open:shadow-md"
                  >
                    <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                      <div className="relative pr-10">
                        <StoryCard story={story} taskCount={storyTasks.length} embedded />
                        <span className="pointer-events-none absolute right-0 top-1 text-sm font-medium text-stone-400 transition group-open:rotate-180">
                          ▾
                        </span>
                      </div>
                    </summary>
                    <div className="mt-5 border-l border-stone-200 pl-6">
                      {storyTasks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {storyTasks.map((task) => (
                            <TaskRow
                              key={task.id}
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
              {unassignedTasks.map((task) => {
                return (
                  <TaskRow
                    key={task.id}
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
