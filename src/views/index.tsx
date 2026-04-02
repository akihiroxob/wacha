import { FC } from "hono/jsx";
import { Layout } from "./layout/Layout.tsx";
import { Project } from "@domain/model/Project.ts";
import { ProjectCard } from "./components/project-card.tsx";

type IndexProps = {
  projects: Project[];
};

export const Index: FC<IndexProps> = ({ projects }) => {
  return (
    <Layout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-8">
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">Wacha</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Projects</h1>
            </div>
            <p className="text-sm text-stone-400">{projects.length} projects</p>
          </div>
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <a href={`/project/${project.id}`} key={project.id}>
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    description={project.description ?? ""}
                    baseDir={project.baseDir}
                    updatedAt={project.updatedAt}
                  />
                </a>
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
