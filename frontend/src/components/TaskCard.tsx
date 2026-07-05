import clsx from "clsx";
import type { TaskDto } from "@shared/apiTypes";
import { StatusBadge } from "@/components/Badge";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";
import { useAcceptTask } from "@/lib/queries";

type TaskCardProps = {
  projectId: string;
  task: TaskDto;
  highlight?: boolean;
  onOpen: (taskId: string) => void;
};

export const TaskCard = ({ projectId, task, highlight = false, onOpen }: TaskCardProps) => {
  const canAccept = task.status === "in_review" || task.status === "wait_accept";
  const acceptTask = useAcceptTask(projectId);

  return (
    <div
      className={clsx(
        "rounded-2xl border bg-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:shadow-md",
        highlight ? "border-amber-200" : "border-stone-200",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          aria-haspopup="dialog"
        >
          <StatusBadge status={task.status} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-stone-900">{task.title}</h3>
            {task.status === "rejected" && task.rejectReason?.trim() && (
              <p className="mt-0.5 truncate text-xs text-red-600">{task.rejectReason}</p>
            )}
          </div>
          <span
            className="shrink-0 text-xs text-stone-400"
            title={formatAbsoluteTime(task.updatedAt)}
          >
            {formatRelativeTime(task.updatedAt)}
          </span>
        </button>
        {canAccept && (
          <button
            type="button"
            onClick={() => acceptTask.mutate(task.id)}
            disabled={acceptTask.isPending}
            className="shrink-0 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            Accept
          </button>
        )}
      </div>
      {acceptTask.error && (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {acceptTask.error.message}
        </p>
      )}
    </div>
  );
};
