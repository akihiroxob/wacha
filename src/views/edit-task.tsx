import type { FC } from "hono/jsx";
import type { Project } from "@domain/model/Project.ts";
import type { Task } from "@domain/model/Task.ts";
import { Layout } from "./layout/Layout.tsx";
import { Button } from "./components/button.tsx";

type EditTaskPageProps = {
  project: Project;
  task: Task;
  values?: {
    title?: string;
    description?: string;
  };
  error?: string | null;
};

export const EditTaskPage: FC<EditTaskPageProps> = ({ project, task, values, error }) => {
  return (
    <Layout>
      <main class="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 md:px-8">
        <a
          href={`/project/${project.id}`}
          class="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:shadow-sm"
        >
          ← プロジェクト詳細に戻る
        </a>

        <section class="rounded-[2rem] border border-stone-200 bg-white px-6 py-8 shadow-sm md:px-8">
          <div class="flex flex-col gap-3">
            <p class="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">
              {project.name}
            </p>
            <h1 class="text-4xl font-semibold tracking-tight text-stone-900">Task を編集</h1>
            <p class="max-w-2xl text-sm leading-7 text-stone-600">
              実装単位の期待が変わったときに title と description を更新します。status や
              Story 紐付けは維持したまま、実行内容だけを現在の期待に合わせて整理してください。
            </p>
          </div>
        </section>

        <form
          method="post"
          action={`/project/${project.id}/task/${task.id}`}
          class="flex flex-col gap-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm md:p-8"
        >
          {error && (
            <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-stone-700">Title</span>
            <input
              type="text"
              name="title"
              value={values?.title ?? task.title}
              placeholder="例: role policy を更新する"
              class="rounded-2xl border border-stone-200 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-400"
              required
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-stone-700">Description</span>
            <p class="text-sm leading-6 text-stone-500">
              最小構成の目安: Given / When / Then / And。既存の状態遷移や非対象条件もここで明示します。
            </p>
            <textarea
              name="description"
              rows={7}
              placeholder={"Given 前提\nWhen 実行すること\nThen 確認したい結果\nAnd 壊してはいけない条件"}
              class="rounded-2xl border border-stone-200 px-4 py-3 text-base leading-7 text-stone-900 outline-none transition focus:border-stone-400"
            >
              {values?.description ?? task.description ?? ""}
            </textarea>
          </label>

          <div class="flex items-center justify-end gap-3">
            <a
              href={`/project/${project.id}`}
              class="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
            >
              キャンセル
            </a>
            <Button text="Task を更新" />
          </div>
        </form>
      </main>
    </Layout>
  );
};
