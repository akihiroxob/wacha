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
      <div className="p-8">
        <h1 className="text-2xl mb-5">Project List</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>
    </Layout>
  );
};
