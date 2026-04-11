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
          row.session_id,
          row.role as ProjectRole,
          row.last_heartbeat_at,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findBySessionId(sessionId: string): Promise<ProjectMembership[]> {
    const rows = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("session_id", "=", sessionId)
      .execute();

    return rows.map(
      (row) =>
        new ProjectMembership(
          row.id,
          row.project_id,
          row.session_id,
          row.role as ProjectRole,
          row.last_heartbeat_at,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByProjectIdAndSessionId(
    projectId: string,
    sessionId: string,
  ): Promise<ProjectMembership[]> {
    const rows = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("session_id", "=", sessionId)
      .execute();

    return rows.map(
      (row) =>
        new ProjectMembership(
          row.id,
          row.project_id,
          row.session_id,
          row.role as ProjectRole,
          row.last_heartbeat_at,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByProjectIdSessionIdAndRole(
    projectId: string,
    sessionId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null> {
    const row = await DatabaseClient.selectFrom("project_membership")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("session_id", "=", sessionId)
      .where("role", "=", role)
      .executeTakeFirst();

    if (!row) return null;

    return new ProjectMembership(
      row.id,
      row.project_id,
      row.session_id,
      row.role as ProjectRole,
      row.last_heartbeat_at,
      row.created_at,
      row.updated_at,
    );
  }

  async create(
    projectId: string,
    sessionId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const projectMembership = await DatabaseClient.insertInto("project_membership")
      .values({
        id,
        project_id: projectId,
        session_id: sessionId,
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
      projectMembership.session_id,
      projectMembership.role as ProjectRole,
      projectMembership.last_heartbeat_at,
      projectMembership.created_at,
      projectMembership.updated_at,
    );
  }

  async save(projectMembership: ProjectMembership): Promise<void> {
    const existingProjectMembership = await this.findByProjectIdSessionIdAndRole(
      projectMembership.projectId,
      projectMembership.sessionId,
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

  async deleteBySessionId(sessionId: string): Promise<void> {
    await DatabaseClient.deleteFrom("project_membership")
      .where("session_id", "=", sessionId)
      .execute();
  }

  async clear(): Promise<void> {
    await DatabaseClient.deleteFrom("project_membership").execute();
  }
}
