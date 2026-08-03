import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ToggleEvent } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { TaskCommentDto, TaskDto } from "@shared/apiTypes";
import { StatusBadge } from "@/components/Badge";
import { Markdown } from "@/components/Markdown";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";
import {
  HUMAN_COMMENT_AUTHOR,
  useAcceptTask,
  useAddTaskComment,
  useCancelTask,
  useRejectTask,
} from "@/lib/queries";

type TaskDrawerProps = {
  projectId: string;
  task: TaskDto;
  comments: TaskCommentDto[];
  onClose: () => void;
};

export const TaskDrawer = ({ projectId, task, comments, onClose }: TaskDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  const canCancel = task.status === "todo" || task.status === "doing";
  const canAccept = task.status === "in_review" || task.status === "wait_accept";
  const canReject = canAccept;

  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const acceptTask = useAcceptTask(projectId);
  const rejectTask = useRejectTask(projectId);
  const cancelTask = useCancelTask(projectId);
  const addComment = useAddTaskComment(projectId);

  const sortedComments = [...comments].sort((a, b) => a.createdAt - b.createdAt);

  // マウント時に popover として開く (選択が変わったら状態をリセット)
  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer && !drawer.matches(":popover-open")) drawer.showPopover();
    setActionError(null);
    setShowRejectForm(false);
    setShowCancelForm(false);
  }, [task.id]);

  const handleToggle = (event: ToggleEvent<HTMLDivElement>) => {
    if (event.newState === "closed") onClose();
  };

  const handleAccept = () => {
    acceptTask.mutate(task.id, {
      onSuccess: () => setActionError(null),
      onError: (error) => setActionError(error.message),
    });
  };

  const handleReject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "");
    rejectTask.mutate(
      { taskId: task.id, reason },
      {
        onSuccess: () => {
          setActionError(null);
          setShowRejectForm(false);
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
      { taskId: task.id, reason },
      {
        onSuccess: () => {
          setActionError(null);
          setShowCancelForm(false);
          form.reset();
        },
        onError: (error) => setActionError(error.message),
      },
    );
  };

  const handleComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    addComment.mutate(
      { taskId: task.id, body },
      {
        onSuccess: () => {
          setActionError(null);
          form.reset();
        },
        onError: (error) => setActionError(error.message),
      },
    );
  };

  const handleCommentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div
      ref={drawerRef}
      popover="auto"
      onToggle={handleToggle}
      className="fixed inset-y-0 left-auto right-0 m-0 h-full max-h-none w-[min(94vw,38rem)] overflow-y-auto border-l border-stone-200 bg-white shadow-2xl backdrop:bg-black/25"
    >
      <div className="flex min-h-full flex-col">
        {/* ヘッダ + アクション */}
        <div className="sticky top-0 z-10 border-b border-stone-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={task.status} />
                <span className="truncate text-xs text-stone-400">{task.id}</span>
              </div>
              <h4 className="mt-1.5 text-xl font-semibold leading-snug text-stone-900">
                {task.title}
              </h4>
              <p className="mt-1 text-xs text-stone-400" title={formatAbsoluteTime(task.updatedAt)}>
                更新 {formatRelativeTime(task.updatedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => drawerRef.current?.hidePopover()}
              className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
              aria-label="Close task detail"
            >
              閉じる
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canAccept && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={acceptTask.isPending}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
              >
                Accept
              </button>
            )}
            {canReject && (
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm((value) => !value);
                  setShowCancelForm(false);
                }}
                className={clsx(
                  "rounded-xl border px-4 py-2 text-sm font-medium transition",
                  showRejectForm
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-red-200 bg-white text-red-600 hover:bg-red-50",
                )}
              >
                Reject…
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setShowCancelForm((value) => !value);
                  setShowRejectForm(false);
                }}
                className={clsx(
                  "rounded-xl border px-4 py-2 text-sm font-medium transition",
                  showCancelForm
                    ? "border-stone-400 bg-stone-100 text-stone-800"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100",
                )}
              >
                Cancel…
              </button>
            )}
            <Link
              to={`/project/${projectId}/task/${task.id}/edit`}
              className="ml-auto rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              編集
            </Link>
          </div>

          {actionError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {showRejectForm && (
            <form onSubmit={handleReject} className="mt-3 flex flex-col gap-2">
              <textarea
                name="reason"
                rows={3}
                required
                autoFocus
                placeholder="差し戻し理由 (問題 / 影響 / 再レビュー条件)"
                className="rounded-xl border border-red-200 px-3 py-2 text-sm leading-6 text-stone-900 outline-none transition focus:border-red-400"
              />
              <button
                type="submit"
                disabled={rejectTask.isPending}
                className="w-fit rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                Reject する
              </button>
            </form>
          )}

          {showCancelForm && (
            <form onSubmit={handleCancel} className="mt-3 flex flex-col gap-2">
              <textarea
                name="reason"
                rows={3}
                required
                autoFocus
                placeholder="キャンセル理由を入力してください"
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
              />
              <button
                type="submit"
                disabled={cancelTask.isPending}
                className="w-fit rounded-xl border border-stone-400 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:opacity-50"
              >
                Cancel する
              </button>
            </form>
          )}
        </div>

        {/* 本文 */}
        <div className="flex flex-1 flex-col gap-5 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
              Description
            </p>
            <div className="mt-2">
              {task.description?.trim() ? (
                <Markdown text={task.description} />
              ) : (
                <p className="text-sm text-stone-400">Description は未設定です。</p>
              )}
            </div>
          </div>

          {task.rejectReason?.trim() && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-400">
                Reject Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800">
                {task.rejectReason}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                Comments
              </p>
              <span className="text-xs text-stone-400">{sortedComments.length}</span>
            </div>
            {sortedComments.length > 0 ? (
              <div className="flex flex-col gap-2">
                {sortedComments.map((comment) => {
                  const isHuman = comment.author === HUMAN_COMMENT_AUTHOR;
                  return (
                    <div
                      key={comment.id}
                      className={clsx(
                        "rounded-2xl border px-4 py-3",
                        isHuman ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={clsx(
                            "text-xs font-medium",
                            isHuman ? "text-amber-700" : "text-stone-500",
                          )}
                        >
                          {comment.author ?? "agent"}
                        </span>
                        <span
                          className="text-xs text-stone-400"
                          title={formatAbsoluteTime(comment.createdAt)}
                        >
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Markdown text={comment.body} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-stone-400">まだコメントはありません。</p>
            )}
          </div>
        </div>

        {/* コメント入力 */}
        <div className="sticky bottom-0 border-t border-stone-100 bg-white px-6 py-4">
          <form onSubmit={handleComment} className="flex flex-col gap-2">
            <textarea
              name="body"
              rows={2}
              required
              onKeyDown={handleCommentKeyDown}
              placeholder="Agent へのコメントを入力 (Markdown可 / ⌘+Enterで送信)"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-400"
            />
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={addComment.isPending}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
