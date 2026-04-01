import { FC } from "hono/jsx";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { TodoBadge, DoingBadge, InReviewBadge, AcceptedBadge, RejectedBadge } from "./badge.tsx";

type TaskRowProps = {
  projectId: string;
  id: string;
  title: string;
  description: string | null;
  status: string;
  updatedAt: number;
};

export const TaskRow: FC<TaskRowProps> = ({ projectId, id, title, description, status, updatedAt }) => {
  const detailId = `task-detail-${id}`;
  const formattedUpdatedAt = new Date(updatedAt).toLocaleString();
  const canDelete = status === TaskStatus.TODO;

  return (
    <>
      <div class="rounded-3xl border border-stone-200 bg-white px-5 py-4 shadow-sm transition hover:border-stone-300 hover:shadow-md">
        <div class="flex items-start justify-between gap-4">
          <button
            type="button"
            popovertarget={detailId}
            class="flex min-w-0 flex-1 cursor-pointer items-start gap-4 text-left"
            aria-haspopup="dialog"
          >
            <div class="flex items-center self-stretch">
              {status === TaskStatus.TODO && <TodoBadge />}
              {status === TaskStatus.DOING && <DoingBadge />}
              {status === TaskStatus.IN_REVIEW && <InReviewBadge />}
              {status === TaskStatus.ACCEPTED && <AcceptedBadge />}
              {status === TaskStatus.REJECTED && <RejectedBadge />}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">{id}</p>
                  <h3 class="mt-1 truncate text-lg font-semibold text-stone-900">{title}</h3>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Updated</p>
                  <span class="mt-1 block text-sm text-stone-600">{formattedUpdatedAt}</span>
                </div>
              </div>
            </div>
          </button>
          {canDelete && (
            <form
              method="post"
              action={`/project/${projectId}/task/${id}/delete`}
              onsubmit={"return confirm('この Task を削除しますか？');"}
            >
              <button
                type="submit"
                class="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                削除
              </button>
            </form>
          )}
        </div>
      </div>

      <div
        id={detailId}
        popover="auto"
        class="fixed inset-0 m-auto max-h-[min(80vh,40rem)] max-w-xl w-[min(90vw,36rem)] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-xl backdrop:bg-black/20"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              {status === TaskStatus.TODO && <TodoBadge />}
              {status === TaskStatus.DOING && <DoingBadge />}
              {status === TaskStatus.IN_REVIEW && <InReviewBadge />}
              {status === TaskStatus.ACCEPTED && <AcceptedBadge />}
              {status === TaskStatus.REJECTED && <RejectedBadge />}
              <p class="text-sm text-stone-500">{id}</p>
            </div>
            <h4 class="text-xl font-semibold text-stone-900">{title}</h4>
          </div>
          <button
            type="button"
            popovertarget={detailId}
            popovertargetaction="hide"
            class="rounded-xl px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
            aria-label="Close task detail"
          >
            閉じる
          </button>
        </div>

        <div class="mt-5 flex flex-col gap-3">
          <div>
            <p class="text-sm font-medium text-stone-500">Description</p>
            <p class="mt-1 whitespace-pre-wrap text-base text-stone-800">
              {description?.trim() ? description : "Description は未設定です。"}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-stone-500">Updated At</p>
            <p class="mt-1 text-base text-stone-800">{formattedUpdatedAt}</p>
          </div>
        </div>
      </div>
    </>
  );
};
