import type { FC } from "hono/jsx";
import { StoryStatus } from "@constants/StoryStatus.ts";
import type { Story } from "@domain/model/Story.ts";
import { CanceledBadge, DoingBadge, DoneBadge, TodoBadge } from "./badge.tsx";

type StoryCardProps = {
  story: Story;
  taskCount?: number;
  embedded?: boolean;
};

export const StoryCard: FC<StoryCardProps> = ({ story, taskCount, embedded = false }) => {
  const containerClass = embedded
    ? "rounded-[1.75rem] bg-white p-0"
    : "rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {story.status === StoryStatus.TODO && <TodoBadge />}
          {story.status === StoryStatus.DOING && <DoingBadge />}
          {story.status === StoryStatus.DONE && <DoneBadge />}
          {story.status === StoryStatus.CANCELED && <CanceledBadge />}
          {typeof taskCount === "number" && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
              {taskCount} tasks
            </span>
          )}
        </div>
        <span className="text-xs text-stone-400">{story.id}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-stone-900">{story.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
        {story.description ?? "Description は未設定です。"}
      </p>
      <p className="mt-4 text-xs text-stone-400">
        更新: {new Date(story.updatedAt).toLocaleString()}
      </p>
    </div>
  );
};
