import { Project } from "@domain/model/Project.ts";
import { ProjectRepository } from "@domain/repository/ProjectRepository.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";

export class SQLiteProjectRepository implements ProjectRepository {
  async findAll(): Promise<Project[]> {
    const rows = await DatabaseClient.selectFrom("project").selectAll().execute();
    return rows.map(
      (row) =>
        new Project(
          row.id,
          row.name,
          row.description,
          row.basedir,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findById(projectId: string): Promise<Project | null> {
    const row = await DatabaseClient.selectFrom("project")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!row) return null;

    return new Project(
      row.id,
      row.name,
      row.description,
      row.basedir,
      row.created_at,
      row.updated_at,
    );
  }

  async create(name: string, description: string | null, baseDir: string): Promise<Project> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const project = await DatabaseClient.insertInto("project")
      .values({
        id,
        name,
        description,
        basedir: baseDir,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Project(
      project.id,
      project.name,
      project.description,
      project.basedir,
      project.created_at,
      project.updated_at,
    );
  }

  async save(project: Project): Promise<void> {
    const existingProject = await this.findById(project.id);
    if (!existingProject) throw new Error("Project not found");

    await DatabaseClient.updateTable("project")
      .set({
        name: project.name,
        description: project.description,
        basedir: project.baseDir,
        updated_at: Date.now(),
      })
      .where("id", "=", project.id)
      .execute();
  }
}
