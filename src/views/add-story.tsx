import type { FC } from "hono/jsx";
import type { Project } from "@domain/model/Project.ts";
import { Layout } from "./layout/Layout.tsx";
import { Button } from "./components/button.tsx";

type AddStoryPageProps = {
  project: Project;
  values?: {
    title?: string;
    description?: string;
  };
  error?: string | null;
};

export const AddStoryPage: FC<AddStoryPageProps> = ({ project, values, error }) => {
  return (
    <Layout>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <a
          href={`/project/${project.id}`}
          class="inline-flex w-fit rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
        >
          ← プロジェクト詳細に戻る
        </a>

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium uppercase tracking-[0.18em] text-gray-400">{project.name}</p>
          <h1 class="text-3xl font-semibold text-gray-900">新しい Story を作成</h1>
          <p class="text-base leading-7 text-gray-600">
            作業のまとまりを Story として登録します。あとから task を紐付けられる前提の入力です。
          </p>
        </div>

        <form
          method="post"
          action={`/project/${project.id}/story`}
          class="flex flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">Title</span>
            <input
              type="text"
              name="title"
              value={values?.title ?? ""}
              placeholder="例: Story 管理画面を追加する"
              class="rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 outline-none transition focus:border-gray-400"
              required
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">Description</span>
            <textarea
              name="description"
              rows={6}
              placeholder="背景、目的、完了条件など"
              class="rounded-xl border border-gray-200 px-4 py-3 text-base leading-7 text-gray-900 outline-none transition focus:border-gray-400"
            >
              {values?.description ?? ""}
            </textarea>
          </label>

          <div class="flex items-center justify-end gap-3">
            <a
              href={`/project/${project.id}`}
              class="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              キャンセル
            </a>
            <Button text="Story を作成" />
          </div>
        </form>
      </div>
    </Layout>
  );
};
