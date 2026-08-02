import type { TaskStatus } from "@constants/TaskStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import type {
  ActiveTaskClaim,
  ProjectActivityRepository,
  ProjectChange,
  UnclaimedDoingTask,
} from "@domain/repository/ProjectActivityRepository.ts";

const parsePayload = (payload: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export class SQLiteProjectActivityRepository implements ProjectActivityRepository {
  async listActiveClaims(projectId: string, now: number): Promise<ActiveTaskClaim[]> {
    const rows = await DatabaseClient.selectFrom("task_claim")
      .innerJoin("task", "task.id", "task_claim.task_id")
      .select([
        "task_claim.id as claim_id",
        "task_claim.task_id",
        "task_claim.principal_id",
        "task_claim.acquired_at",
        "task_claim.renewed_at",
        "task_claim.expires_at",
        "task.title as task_title",
        "task.status as task_status",
      ])
      .where("task.project_id", "=", projectId)
      .where("task_claim.state", "=", "active")
      .where("task_claim.expires_at", ">", now)
      .orderBy("task_claim.acquired_at", "desc")
      .execute();

    return rows.map((row) => ({
      claimId: row.claim_id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      taskStatus: row.task_status as TaskStatus,
      principalId: row.principal_id,
      acquiredAt: row.acquired_at,
      renewedAt: row.renewed_at,
      expiresAt: row.expires_at,
    }));
  }

  async listUnclaimedDoingTasks(
    projectId: string,
    now: number,
  ): Promise<UnclaimedDoingTask[]> {
    const tasks = await DatabaseClient.selectFrom("task")
      .select(["id", "title", "status"])
      .where("project_id", "=", projectId)
      .where("status", "=", "doing")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc")
      .execute();

    if (tasks.length === 0) return [];

    const claims = await DatabaseClient.selectFrom("task_claim")
      .select(["task_id", "principal_id", "state", "acquired_at", "expires_at"])
      .where(
        "task_id",
        "in",
        tasks.map((task) => task.id),
      )
      .orderBy("acquired_at", "desc")
      .execute();

    const tasksWithActiveClaim = new Set(
      claims
        .filter((claim) => claim.state === "active" && claim.expires_at > now)
        .map((claim) => claim.task_id),
    );
    const latestClaimByTaskId = new Map<string, (typeof claims)[number]>();
    for (const claim of claims) {
      if (!latestClaimByTaskId.has(claim.task_id)) {
        latestClaimByTaskId.set(claim.task_id, claim);
      }
    }

    return tasks
      .filter((task) => !tasksWithActiveClaim.has(task.id))
      .map((task) => {
        const latestClaim = latestClaimByTaskId.get(task.id);
        return {
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status as TaskStatus,
          lastPrincipalId: latestClaim?.principal_id ?? null,
          lastExpiresAt: latestClaim?.expires_at ?? null,
        };
      });
  }

  async listRecentChanges(projectId: string, limit: number): Promise<ProjectChange[]> {
    const rows = await DatabaseClient.selectFrom("change_log")
      .leftJoin("task", "task.id", "change_log.entity_id")
      .leftJoin("story", "story.id", "change_log.entity_id")
      .select([
        "change_log.cursor",
        "change_log.type",
        "change_log.entity_id",
        "change_log.principal_id",
        "change_log.claim_id",
        "change_log.payload",
        "change_log.occurred_at",
        "task.title as task_title",
        "story.title as story_title",
      ])
      .where("change_log.project_id", "=", projectId)
      .orderBy("change_log.cursor", "desc")
      .limit(limit)
      .execute();

    return rows.map((row) => ({
      cursor: row.cursor,
      type: row.type,
      entityId: row.entity_id,
      entityTitle: row.task_title ?? row.story_title,
      principalId: row.principal_id,
      claimId: row.claim_id,
      payload: parsePayload(row.payload),
      occurredAt: row.occurred_at,
    }));
  }
}
