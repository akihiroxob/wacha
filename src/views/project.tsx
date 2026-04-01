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
  return (
    <Layout>
      <div className="flex flex-col gap-4 p-8">
        <a
          href="/"
          className="inline-flex rounded-xl p-2 w-fit text-m text-gray-500 hover:bg-gray-100 hover:shadow-sm"
        >
          ← プロジェクト一覧に戻る
        </a>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-gray-600">{project.description}</p>
          <p className="text-gray-400">最終更新:{new Date(project.updatedAt).toLocaleString()}</p>
        </div>
        <a href={`/project/${project.id}/story/add`}>
          <Button text="+ 新しいStoryを作成" />
        </a>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Stories</h2>
            <p className="text-sm text-gray-400">{stories.length} items</p>
          </div>
          {stories.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {stories.map((story) => <StoryCard key={story.id} story={story} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-6 text-sm text-gray-500">
              まだ Story はありません。上のボタンから追加してください。
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">タスクのステータス</h2>
            <p className="text-sm text-gray-400">{summary.total} tasks</p>
          </div>
          {tasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
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
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-6 text-sm text-gray-500">
              まだ Task はありません。
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
