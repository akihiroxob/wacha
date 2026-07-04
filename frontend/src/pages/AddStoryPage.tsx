import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { useCreateStory, useProject } from "@/lib/queries";

export const AddStoryPage = () => {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data } = useProject(projectId);
  const createStory = useCreateStory(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createStory.mutate(
      { title, description },
      {
        onSuccess: () => navigate(`/project/${projectId}`),
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

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
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
              新しい Story を作成
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-stone-600">
              作業のまとまりを Story として登録します。Story は SMART を意識しつつ、背景、
              達成したいこと、完了条件を短く整理してください。
            </p>
          </div>
        </section>

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
              placeholder="例: Story 管理画面を追加する"
              className="rounded-2xl border border-stone-200 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-stone-400"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-700">Description</span>
            <p className="text-sm leading-6 text-stone-500">
              最小構成の目安: 背景 / 達成したいこと / 完了条件。制約や期限があれば最後に足してください。
            </p>
            <textarea
              name="description"
              rows={7}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder={
                "背景:\n- なぜやるか\n\n達成したいこと:\n- どうなればよいか\n\n完了条件:\n- 確認できる結果\n\n制約:\n- あれば書く"
              }
              className="rounded-2xl border border-stone-200 px-4 py-3 text-base leading-7 text-stone-900 outline-none transition focus:border-stone-400"
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <Link
              to={`/project/${projectId}`}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
            >
              キャンセル
            </Link>
            <Button text="Story を作成" />
          </div>
        </form>
      </main>
    </Layout>
  );
};
