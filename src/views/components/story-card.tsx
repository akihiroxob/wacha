import type { FC } from "hono/jsx";
import type { Story } from "@domain/model/Story.ts";

type StoryCardProps = {
  story: Story;
};

export const StoryCard: FC<StoryCardProps> = ({ story }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
          {story.status}
        </span>
        <span className="text-xs text-gray-400">{story.id}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{story.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
        {story.description ?? "Description は未設定です。"}
      </p>
      <p className="mt-4 text-xs text-gray-400">
        更新: {new Date(story.updatedAt).toLocaleString()}
      </p>
    </div>
  );
};
