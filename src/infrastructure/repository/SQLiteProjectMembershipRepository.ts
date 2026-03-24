import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";

export class SQLiteProjectMembershipRepository implements ProjectMembershipRepository {
  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    const rows = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("project_id", "=", projectId)
      .execute();

    return rows.map(
      (row) =>
        new ProjectMembership(
          row.id,
          row.project_id,
          row.worker_id,
          row.role as ProjectRole,
          row.last_heartbeat_at,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByProjectIdAndWorkerId(
    projectId: string,
    workerId: string,
  ): Promise<ProjectMembership[]> {
    const rows = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("worker_id", "=", workerId)
      .execute();

    return rows.map(
      (row) =>
        new ProjectMembership(
          row.id,
          row.project_id,
          row.worker_id,
          row.role as ProjectRole,
          row.last_heartbeat_at,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByProjectIdWorkerIdAndRole(
    projectId: string,
    workerId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null> {
    const row = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("worker_id", "=", workerId)
      .where("role", "=", role)
      .executeTakeFirst();

    if (!row) return null;

    return new ProjectMembership(
      row.id,
      row.project_id,
      row.worker_id,
      row.role as ProjectRole,
      row.last_heartbeat_at,
      row.created_at,
      row.updated_at,
    );
  }

  async create(projectId: string, workerId: string, role: ProjectRole): Promise<ProjectMembership> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const projectMembership = await DatabaseClient.insertInto("project_membership")
      .values({
        id,
        project_id: projectId,
        worker_id: workerId,
        role,
        last_heartbeat_at: now,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new ProjectMembership(
      projectMembership.id,
      projectMembership.project_id,
      projectMembership.worker_id,
      projectMembership.role as ProjectRole,
      projectMembership.last_heartbeat_at,
      projectMembership.created_at,
      projectMembership.updated_at,
    );
  }

  async save(projectMembership: ProjectMembership): Promise<void> {
    const existingProjectMembership = await this.findByProjectIdWorkerIdAndRole(
      projectMembership.projectId,
      projectMembership.workerId,
      projectMembership.role,
    );
    if (!existingProjectMembership) throw new Error("ProjectMembership not found");

    await DatabaseClient.updateTable("project_membership")
      .set({
        last_heartbeat_at: projectMembership.lastHeartbeatAt,
        updated_at: projectMembership.updatedAt,
      })
      .where("id", "=", projectMembership.id)
      .execute();
  }

  async delete(projectMembershipId: string): Promise<void> {
    await DatabaseClient.deleteFrom("project_membership")
      .where("id", "=", projectMembershipId)
      .execute();
  }
}
