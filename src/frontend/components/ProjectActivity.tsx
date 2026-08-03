import { useState } from "react";
import clsx from "clsx";
import type {
  ActiveTaskClaimDto,
  ProjectChangeDto,
  TaskStatus,
  UnclaimedDoingTaskDto,
} from "@shared/apiTypes";
import { useProjectActivity } from "@/lib/queries";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";

const PAGE_SIZE = 20;

const phaseForStatus = (status: TaskStatus) => {
  if (status === "doing") {
    return { label: "作業", className: "bg-blue-100 text-blue-700" };
  }
  if (status === "in_review") {
    return { label: "レビュー", className: "bg-purple-100 text-purple-700" };
  }
  if (status === "wait_accept") {
    return { label: "受入", className: "bg-green-100 text-green-700" };
  }
  return { label: status, className: "bg-stone-100 text-stone-600" };
};

const formatRemaining = (expiresAt: number, now = Date.now()) => {
  const remainingMs = Math.max(0, expiresAt - now);
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes < 60) return `残り ${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `残り ${hours}時間${restMinutes > 0 ? `${restMinutes}分` : ""}`;
};

const changeLabels: Record<string, string> = {
  TASK_CLAIMED: "TaskをClaimしました",
  CLAIM_RELEASED: "Claimを解放しました",
  CLAIM_EXPIRED: "Claimの期限が切れました",
  TASK_COMPLETED: "Taskをレビューへ進めました",
  TASK_REVIEWED: "Taskを受入待ちへ進めました",
  TASK_ACCEPTED: "Taskを受け入れました",
  TASK_REJECTED: "Taskを差し戻しました",
  TASK_CANCELED: "Taskをキャンセルしました",
  TASK_CREATED: "Taskを作成しました",
  TASK_MIGRATED: "Taskを移行しました",
  STORY_CREATED: "Storyを作成しました",
  STORY_STARTED: "Storyを開始しました",
  STORY_COMPLETED: "Storyを完了しました",
  STORY_CANCELED: "Storyをキャンセルしました",
};

const payloadText = (change: ProjectChangeDto) => {
  const { fromStatus, toStatus, reason } = change.payload;
  const parts: string[] = [];
  if (typeof fromStatus === "string" && typeof toStatus === "string") {
    parts.push(`${fromStatus} → ${toStatus}`);
  }
  if (typeof reason === "string" && reason.trim() !== "") parts.push(reason);
  return parts.join(" ・ ");
};

const CurrentClaimRow = ({
  claim,
  onOpenTask,
}: {
  claim: ActiveTaskClaimDto;
  onOpenTask: (taskId: string) => void;
}) => {
  const phase = phaseForStatus(claim.taskStatus);
  return (
    <button
      type="button"
      onClick={() => onOpenTask(claim.taskId)}
      className="grid w-full gap-3 border-t border-stone-100 px-5 py-4 text-left transition hover:bg-stone-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_9rem] md:items-center"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-stone-900">{claim.taskTitle}</span>
        <span className="mt-1 block text-xs text-stone-400">Claim {claim.claimId}</span>
      </span>
      <code className="truncate text-xs text-stone-600">{claim.principalId}</code>
      <span
        className={clsx(
          "w-fit rounded-full px-3 py-1 text-xs font-medium",
          phase.className,
        )}
      >
        {phase.label}
      </span>
      <span className="text-sm text-stone-600" title={formatAbsoluteTime(claim.expiresAt)}>
        {formatRemaining(claim.expiresAt)}
      </span>
    </button>
  );
};

const UnclaimedDoingRow = ({
  task,
  onOpenTask,
}: {
  task: UnclaimedDoingTaskDto;
  onOpenTask: (taskId: string) => void;
}) => {
  const expired = task.lastExpiresAt !== null && task.lastExpiresAt <= Date.now();
  return (
    <button
      type="button"
      onClick={() => onOpenTask(task.taskId)}
      className="grid w-full gap-3 border-t border-amber-100 bg-amber-50/50 px-5 py-4 text-left transition hover:bg-amber-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_9rem] md:items-center"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-stone-900">{task.taskTitle}</span>
        <span className="mt-1 block text-xs text-amber-700">Doingですが有効なClaimがありません</span>
      </span>
      <code className="truncate text-xs text-stone-600">
        {task.lastPrincipalId ?? "—"}
      </code>
      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        {expired ? "Claim期限切れ" : "Claimなし"}
      </span>
      <span
        className="text-sm text-amber-800"
        title={task.lastExpiresAt ? formatAbsoluteTime(task.lastExpiresAt) : undefined}
      >
        {task.lastExpiresAt ? formatRelativeTime(task.lastExpiresAt) : "期限情報なし"}
      </span>
    </button>
  );
};

const ActivityLogItem = ({
  change,
  canOpenTask,
  onOpenTask,
}: {
  change: ProjectChangeDto;
  canOpenTask: boolean;
  onOpenTask: (taskId: string) => void;
}) => {
  const details = payloadText(change);
  const content = (
    <>
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-50" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-stone-900">
            {changeLabels[change.type] ?? change.type}
          </span>
          <code className="text-xs text-stone-500">{change.principalId}</code>
        </span>
        <span className="mt-1 block truncate text-sm text-stone-600">
          {change.entityTitle ?? change.entityId}
        </span>
        {details && <span className="mt-1 block text-xs text-stone-400">{details}</span>}
      </span>
      <time
        className="shrink-0 text-xs text-stone-400"
        dateTime={new Date(change.occurredAt).toISOString()}
        title={formatAbsoluteTime(change.occurredAt)}
      >
        {formatRelativeTime(change.occurredAt)}
      </time>
    </>
  );

  return canOpenTask ? (
    <button
      type="button"
      onClick={() => onOpenTask(change.entityId)}
      className="flex w-full gap-4 border-t border-stone-100 px-5 py-4 text-left transition hover:bg-stone-50"
    >
      {content}
    </button>
  ) : (
    <div className="flex gap-4 border-t border-stone-100 px-5 py-4">{content}</div>
  );
};

export const ProjectClaims = ({
  projectId,
  onOpenTask,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
}) => {
  const { data, isPending, error } = useProjectActivity(projectId, 1);

  if (isPending) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
        Claimを読み込み中...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error?.message ?? "Claimの読み込みに失敗しました。"}
      </div>
    );
  }

  const currentCount = data.activeClaims.length + data.unclaimedDoingTasks.length;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-5 md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">現在のClaim</h2>
          <p className="text-sm text-stone-500">現在誰がどのTaskを担当しているか</p>
        </div>
        <p className="text-sm text-stone-400">{currentCount} tasks</p>
      </div>
      {currentCount > 0 ? (
        <div>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_9rem] gap-3 border-t border-stone-100 bg-stone-50 px-5 py-2 text-xs font-medium text-stone-500 md:grid">
            <span>Task</span>
            <span>Agent</span>
            <span>フェーズ</span>
            <span>有効期限</span>
          </div>
          {data.activeClaims.map((claim) => (
            <CurrentClaimRow key={claim.claimId} claim={claim} onOpenTask={onOpenTask} />
          ))}
          {data.unclaimedDoingTasks.map((task) => (
            <UnclaimedDoingRow key={task.taskId} task={task} onOpenTask={onOpenTask} />
          ))}
        </div>
      ) : (
        <div className="border-t border-stone-100 px-5 py-8 text-sm text-stone-500">
          現在ClaimされているTaskはありません。
        </div>
      )}
    </section>
  );
};

export const ProjectActivityLog = ({
  projectId,
  taskIds,
  onOpenTask,
}: {
  projectId: string;
  taskIds: Set<string>;
  onOpenTask: (taskId: string) => void;
}) => {
  const [changeLimit, setChangeLimit] = useState(PAGE_SIZE);
  const { data, isPending, error, isFetching } = useProjectActivity(projectId, changeLimit);

  if (isPending) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
        アクティビティを読み込み中...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error?.message ?? "アクティビティの読み込みに失敗しました。"}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-5 md:px-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">アクティビティログ</h2>
            <p className="text-sm text-stone-500">Agentによる状態変更を新しい順に表示</p>
          </div>
          {isFetching && <p className="text-xs text-stone-400">更新中...</p>}
        </div>
        {data.changes.length > 0 ? (
          <div>
            {data.changes.map((change) => (
              <ActivityLogItem
                key={change.cursor}
                change={change}
                canOpenTask={taskIds.has(change.entityId)}
                onOpenTask={onOpenTask}
              />
            ))}
            {data.hasMoreChanges && (
              <div className="border-t border-stone-100 px-5 py-4 text-center">
                <button
                  type="button"
                  onClick={() => setChangeLimit((current) => Math.min(current + PAGE_SIZE, 200))}
                  disabled={isFetching || changeLimit >= 200}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                >
                  さらに読み込む
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-stone-100 px-5 py-8 text-sm text-stone-500">
            アクティビティログはまだありません。
          </div>
        )}
    </section>
  );
};
