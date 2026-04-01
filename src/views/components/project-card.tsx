import { FC } from "hono/jsx";

type ProjectCardProps = {
  id: string;
  name: string;
  description: string;
  baseDir: string;
  updatedAt: number;
};

export const ProjectCard: FC<ProjectCardProps> = ({
  id,
  name,
  description,
  baseDir,
  updatedAt,
}) => {
  return (
    <div className="flex h-full cursor-pointer flex-col gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
          Project
        </span>
        <span className="text-xs text-stone-400">{id}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{name}</h2>
        <p className="line-clamp-3 text-sm leading-7 text-stone-600">
          {description || "プロジェクトの説明はまだ設定されていません。"}
        </p>
      </div>
      <div className="border-t border-stone-100 pt-4 text-sm text-stone-500">
        <p>Base Dir: {baseDir}</p>
        <p className="mt-1">Updated At: {new Date(updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
};
