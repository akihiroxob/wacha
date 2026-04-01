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
    <div className="flex flex-col gap-4 cursor-pointer h-full rounded-xl border border-gray-300 p-4 block hover:shadow-lg transition-shadow">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl">{name}</h2>
        <p className="text-base">{description}</p>
      </div>
      <div className="border-b border-gray-200" />
      <div className="text-sm text-gray-500 flex flex-col gap-1">
        <p className="">Base Dir: {baseDir}</p>
        <p className="">Updated At: {new Date(updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
};
