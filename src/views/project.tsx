import type { FC } from "hono/jsx";
import { type TaskStatus as TaskStatusValue } from "@constants/TaskStatus.ts";
import type { Task } from "@domain/model/Task.ts";
import type { Project } from "@domain/model/Project.ts";
import { Layout } from "./layout/Layout.tsx";
import { Button } from "./components/button.tsx";
import { TaskRow } from "./components/task-row.tsx";

type ProjectProps = {
  summary: {
    total: number;
    byStatus: Record<TaskStatusValue, number>;
    lastUpdatedAt: number | null;
  };
  tasks: Task[];
  project: Project;
};

export const ProjectPage: FC<ProjectProps> = ({ summary, tasks, project }) => {
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
          <p className="text-gray-400">最終更新:{project.updatedAt.toLocaleString()}</p>
        </div>
        <a href="/project/1/add">
          <Button text="+ 新しいStoryを作成" />
        </a>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">タスクのステータス</h2>
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
        </div>
      </div>
    </Layout>
  );
};
