import { FC } from "hono/jsx";
import { TaskStatus } from "@constants/TaskStatus.ts";
import {
  TodoBadge,
  DoingBadge,
  InReviewBadge,
  WaitAcceptBadge,
  AcceptedBadge,
  RejectedBadge,
} from "./badge.tsx";
import type { TaskComment } from "@domain/model/TaskComment.ts";
import type { TaskReject } from "@domain/model/TaskReject.ts";

type TaskRowProps = {
  projectId: string;
  id: string;
  title: string;
  description: string | null;
  status: string;
  rejectReason: string | null;
  rejects: TaskReject[];
  comments: TaskComment[];
  updatedAt: number;
};

export const TaskRow: FC<TaskRowProps> = ({
  projectId,
  id,
  title,
  description,
  status,
  rejectReason,
  rejects,
  comments,
  updatedAt,
}) => {
  const detailId = `task-detail-${id}`;
  const formattedUpdatedAt = new Date(updatedAt).toLocaleString();
  const canDelete = status === TaskStatus.TODO;
  const canAccept = status === TaskStatus.IN_REVIEW || status === TaskStatus.WAIT_ACCEPT;
  const canReject = status === TaskStatus.IN_REVIEW || status === TaskStatus.WAIT_ACCEPT;

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
              {status === TaskStatus.WAIT_ACCEPT && <WaitAcceptBadge />}
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
                  <p class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                    Updated
                  </p>
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
        class="fixed inset-0 m-auto max-h-[min(80vh,40rem)] max-w-3xl w-[min(90vw,48rem)] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-xl backdrop:bg-black/20"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              {status === TaskStatus.TODO && <TodoBadge />}
              {status === TaskStatus.DOING && <DoingBadge />}
              {status === TaskStatus.IN_REVIEW && <InReviewBadge />}
              {status === TaskStatus.WAIT_ACCEPT && <WaitAcceptBadge />}
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
          {rejectReason?.trim() && (
            <div>
              <p class="text-sm font-medium text-stone-500">Reject Reason</p>
              <p class="mt-1 whitespace-pre-wrap text-base text-stone-800">{rejectReason}</p>
            </div>
          )}
          {rejects.length > 0 && (
            <div>
              <p class="text-sm font-medium text-stone-500">Reject History</p>
              <div class="mt-2 flex flex-col gap-2">
                {rejects.map((reject) => (
                  <div key={reject.id} class="rounded-2xl bg-red-50 px-4 py-3">
                    <p class="whitespace-pre-wrap text-sm text-red-900">{reject.reason}</p>
                    <p class="mt-1 text-xs text-red-500">
                      {reject.author ?? "unknown"} / {new Date(reject.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div class="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-stone-700">Comments</p>
              <span class="text-xs text-stone-400">{comments.length}</span>
            </div>
            {comments.length > 0 && (
              <div class="mt-3 flex flex-col gap-2">
                {comments.map((comment) => (
                  <div key={comment.id} class="rounded-xl bg-white px-3 py-2 text-sm text-stone-700">
                    <p class="whitespace-pre-wrap">{comment.body}</p>
                    <p class="mt-1 text-xs text-stone-400">
                      {comment.author ?? "unknown"} / {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <form
              method="post"
              action={`/project/${projectId}/task/${id}/comment`}
              class="mt-3 flex flex-col gap-2"
            >
              <textarea
                name="body"
                rows={2}
                required
                placeholder="コメントを入力"
                class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
              />
              <button
                type="submit"
                class="w-fit rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Add Comment
              </button>
            </form>
          </div>
          <div>
            <p class="text-sm font-medium text-stone-500">Updated At</p>
            <p class="mt-1 text-base text-stone-800">{formattedUpdatedAt}</p>
          </div>
          {(canAccept || canReject) && (
            <div class="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p class="text-sm font-medium text-stone-700">Task Actions</p>
              <div class="mt-3 flex flex-col gap-3">
                {canAccept && (
                  <form method="post" action={`/project/${projectId}/task/${id}/accept`}>
                    <button
                      type="submit"
                      class="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                    >
                      Accept
                    </button>
                  </form>
                )}
                {canReject && (
                  <form
                    method="post"
                    action={`/project/${projectId}/task/${id}/reject`}
                    class="flex flex-col gap-3"
                  >
                    <label class="flex flex-col gap-2">
                      <span class="text-sm font-medium text-stone-700">Reject reason</span>
                      <textarea
                        name="reason"
                        rows={3}
                        required
                        placeholder="差し戻し理由を入力してください"
                        class="rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
                      />
                    </label>
                    <button
                      type="submit"
                      class="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
