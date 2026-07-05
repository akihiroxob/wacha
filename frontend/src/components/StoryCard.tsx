import type { StoryDto } from "@shared/apiTypes";

type StoryCardProps = {
  story: StoryDto;
  taskCount?: number;
  embedded?: boolean;
};

export const StoryCard = ({ story, embedded = false }: StoryCardProps) => {
  const containerClass = embedded
    ? "rounded-[1.75rem] bg-white p-0"
    : "rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md";

  return (
    <div className={containerClass}>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
        {story.description ?? "Description は未設定です。"}
      </p>
      <p className="mt-4 text-xs text-stone-400">
        更新: {new Date(story.updatedAt).toLocaleString()}
      </p>
    </div>
  );
};
