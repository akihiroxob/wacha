import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { TaskCommentDto } from "@shared/apiTypes";
import {
  TodoBadge,
  DoingBadge,
  CanceledBadge,
  InReviewBadge,
  WaitAcceptBadge,
  AcceptedBadge,
  RejectedBadge,
} from "@/components/Badge";
import { Markdown } from "@/components/Markdown";
import {
  useAcceptTask,
  useAddTaskComment,
  useCancelTask,
  useRejectTask,
} from "@/lib/queries";

type TaskRowProps = {
  projectId: string;
  id: string;
  title: string;
  description: string | null;
  status: string;
  rejectReason: string | null;
  comments: TaskCommentDto[];
  updatedAt: number;
};

const StatusBadge = ({ status }: { status: string }) => (
  <>
    {status === "todo" && <TodoBadge />}
    {status === "doing" && <DoingBadge />}
    {status === "canceled" && <CanceledBadge />}
    {status === "in_review" && <InReviewBadge />}
    {status === "wait_accept" && <WaitAcceptBadge />}
    {status === "accepted" && <AcceptedBadge />}
    {status === "rejected" && <RejectedBadge />}
  </>
);

export const TaskRow = ({
  projectId,
  id,
  title,
  description,
  status,
  rejectReason,
  comments,
  updatedAt,
}: TaskRowProps) => {
  const detailId = `task-detail-${id}`;
  const formattedUpdatedAt = new Date(updatedAt).toLocaleString();
  const canCancel = status === "todo" || status === "doing";
  const canAccept = status === "in_review" || status === "wait_accept";
  const canReject = status === "in_review" || status === "wait_accept";

  const [actionError, setActionError] = useState<string | null>(null);
  const acceptTask = useAcceptTask(projectId);
  const rejectTask = useRejectTask(projectId);
  const cancelTask = useCancelTask(projectId);
  const addComment = useAddTaskComment(projectId);

  const handleComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    addComment.mutate(
      { taskId: id, body },
      {
        onSuccess: () => {
          setActionError(null);
          form.reset();
        },
        onError: (error) => setActionError(error.message),
      },
    );
  };

  const handleAccept = () => {
    acceptTask.mutate(id, {
      onSuccess: () => setActionError(null),
      onError: (error) => setActionError(error.message),
    });
  };

  const handleReject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "");
    rejectTask.mutate(
      { taskId: id, reason },
      {
        onSuccess: () => {
          setActionError(null);
          form.reset();
        },
        onError: (error) => setActionError(error.message),
      },
    );
  };

  const handleCancel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "");
    cancelTask.mutate(
      { taskId: id, reason },
      {
        onSuccess: () => {
          setActionError(null);
          form.reset();
        },
        onError: (error) => setActionError(error.message),
      },
    );
  };

  return (
    <>
      <div className="rounded-3xl border border-stone-200 bg-white px-5 py-4 shadow-sm transition hover:border-stone-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            popoverTarget={detailId}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-4 text-left"
            aria-haspopup="dialog"
          >
            <div className="flex items-center self-stretch">
              <StatusBadge status={status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                    {id}
                  </p>
                  <h3 className="mt-1 truncate text-lg font-semibold text-stone-900">{title}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                    Updated
                  </p>
                  <span className="mt-1 block text-sm text-stone-600">{formattedUpdatedAt}</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div
        id={detailId}
        popover="auto"
        className="fixed inset-0 m-auto max-h-[min(80vh,40rem)] max-w-3xl w-[min(90vw,48rem)] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-xl backdrop:bg-black/20"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <StatusBadge status={status} />
              <p className="text-sm text-stone-500">{id}</p>
            </div>
            <h4 className="text-xl font-semibold text-stone-900">{title}</h4>
          </div>
          <button
            type="button"
            popoverTarget={detailId}
            popoverTargetAction="hide"
            className="rounded-xl px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
            aria-label="Close task detail"
          >
            閉じる
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {actionError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}
          <div className="flex justify-end">
            <Link
              to={`/project/${projectId}/task/${id}/edit`}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              編集
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-base text-stone-800">
              {description?.trim() ? description : "Description は未設定です。"}
            </p>
          </div>
          {rejectReason?.trim() && (
            <div>
              <p className="text-sm font-medium text-stone-500">Reject Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-base text-stone-800">{rejectReason}</p>
            </div>
          )}
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-stone-700">Comments</p>
              <span className="text-xs text-stone-400">{comments.length}</span>
            </div>
            {comments.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl bg-white px-3 py-2 text-sm text-stone-700"
                  >
                    <Markdown text={comment.body} />
                    <p className="mt-1 text-xs text-stone-400">
                      {comment.author ?? "unknown"} / {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleComment} className="mt-3 flex flex-col gap-2">
              <textarea
                name="body"
                rows={2}
                required
                placeholder="コメントを入力"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
              />
              <button
                type="submit"
                disabled={addComment.isPending}
                className="w-fit rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Add Comment
              </button>
            </form>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">Updated At</p>
            <p className="mt-1 text-base text-stone-800">{formattedUpdatedAt}</p>
          </div>
          {(canAccept || canReject) && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-700">Task Actions</p>
              <div className="mt-3 flex flex-col gap-3">
                {canAccept && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={acceptTask.isPending}
                    className="inline-flex w-fit items-center justify-center rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                )}
                {canReject && (
                  <form onSubmit={handleReject} className="flex flex-col gap-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-stone-700">Reject reason</span>
                      <textarea
                        name="reason"
                        rows={3}
                        required
                        placeholder="差し戻し理由を入力してください"
                        className="rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={rejectTask.isPending}
                      className="inline-flex w-fit items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
          {canCancel && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-700">Cancel Task</p>
              <form onSubmit={handleCancel} className="mt-3 flex flex-col gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-stone-700">Cancel reason</span>
                  <textarea
                    name="reason"
                    rows={3}
                    required
                    placeholder="キャンセル理由を入力してください"
                    className="rounded-2xl border border-stone-200 px-4 py-3 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
                  />
                </label>
                <button
                  type="submit"
                  disabled={cancelTask.isPending}
                  className="inline-flex w-fit items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
