import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { useProjects } from "@/lib/queries";

export const ProjectListPage = () => {
  const { data, isPending, error } = useProjects();

  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-8">
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
                Wacha
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
                Projects
              </h1>
            </div>
            <p className="text-sm text-stone-400">{data?.projects.length ?? 0} projects</p>
          </div>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error.message}
            </div>
          )}
          {isPending ? (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              読み込み中...
            </div>
          ) : data && data.projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((project) => (
                <Link to={`/project/${project.id}`} key={project.id}>
                  <ProjectCard
                    id={project.id}
                    name={project.name}
                    description={project.description ?? ""}
                    baseDir={project.baseDir}
                    updatedAt={project.updatedAt}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">
              まだ Project はありません。
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
};
