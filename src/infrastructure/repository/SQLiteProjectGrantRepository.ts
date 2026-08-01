import type { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import type { ProjectGrantRepository } from "@domain/repository/ProjectGrantRepository.ts";

export class SQLiteProjectGrantRepository implements ProjectGrantRepository {
  async grant(projectId: string, principalId: string, role: ProjectRole): Promise<void> {
    await DatabaseClient.insertInto("project_grant")
      .values({
        project_id: projectId,
        principal_id: principalId,
        role,
        created_at: Date.now(),
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  async revoke(projectId: string, principalId: string, role: ProjectRole): Promise<void> {
    await DatabaseClient.deleteFrom("project_grant")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .where("role", "=", role)
      .execute();
  }

  async hasRole(projectId: string, principalId: string, role: ProjectRole): Promise<boolean> {
    const row = await DatabaseClient.selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .where("role", "=", role)
      .executeTakeFirst();
    return row !== undefined;
  }

  async listRoles(projectId: string, principalId: string): Promise<ProjectRole[]> {
    const rows = await DatabaseClient.selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .orderBy("role", "asc")
      .execute();
    return rows.map((row) => row.role as ProjectRole);
  }

  async listByProjectId(projectId: string) {
    const rows = await DatabaseClient.selectFrom("project_grant")
      .select(["project_id", "principal_id", "role", "created_at"])
      .where("project_id", "=", projectId)
      .orderBy("role", "asc")
      .orderBy("principal_id", "asc")
      .execute();
    return rows.map((row) => ({
      projectId: row.project_id,
      principalId: row.principal_id,
      role: row.role as ProjectRole,
      createdAt: row.created_at,
    }));
  }
}
