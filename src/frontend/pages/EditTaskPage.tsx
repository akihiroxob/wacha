import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ProjectDto, TaskDto } from "@shared/apiTypes";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { useProject, useUpdateTask } from "@/lib/queries";

const EditTaskForm = ({ project, task }: { project: ProjectDto; task: TaskDto }) => {
  const navigate = useNavigate();
  const updateTask = useUpdateTask(project.id);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateTask.mutate(
      { taskId: task.id, title, description },
      {
        onSuccess: () => navigate(`/project/${project.id}`),
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">Title</span>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="例: role policy を更新する"
          className="rounded-2xl border border-stone-200 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-400"
          required
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">Description</span>
        <p className="text-sm leading-6 text-stone-500">
          最小構成の目安: Given / When / Then / And。既存の状態遷移や非対象条件もここで明示します。
        </p>
        <textarea
          name="description"
          rows={7}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          placeholder={"Given 前提\nWhen 実行すること\nThen 確認したい結果\nAnd 壊してはいけない条件"}
          className="rounded-2xl border border-stone-200 px-4 py-3 text-base leading-7 text-stone-900 outline-none transition focus:border-stone-400"
        />
      </label>

      <div className="flex items-center justify-end gap-3">
        <Link
          to={`/project/${project.id}`}
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
        >
          キャンセル
        </Link>
        <Button text="Task を更新" />
      </div>
    </form>
  );
};

export const EditTaskPage = () => {
  const { projectId = "", taskId = "" } = useParams();
  const { data, isPending, error } = useProject(projectId);

  const task = data?.tasks.find((candidate) => candidate.id === taskId) ?? null;

  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 md:px-8">
        <Link
          to={`/project/${projectId}`}
          className="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
        >
          ← プロジェクト詳細に戻る
        </Link>

        <section className="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 shadow-sm md:px-8">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">
              {data?.project.name ?? ""}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Task を編集</h1>
            <p className="max-w-2xl text-sm leading-7 text-stone-600">
              実装単位の期待が変わったときに title と description を更新します。status や
              Story 紐付けは維持したまま、実行内容だけを現在の期待に合わせて整理してください。
            </p>
          </div>
        </section>

        {isPending ? (
          <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
            読み込み中...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        ) : !data || !task ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Task が見つかりません。
          </div>
        ) : (
          <EditTaskForm key={task.id} project={data.project} task={task} />
        )}
      </main>
    </Layout>
  );
};
