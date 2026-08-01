import type { Kysely, Transaction } from "kysely";

import { CoordinationError } from "@application/error/CoordinationError.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "@constants/TaskStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import type { DataBase } from "@database/schema/index.ts";
import type { TaskClaimTable } from "@database/schema/taskClaim.ts";

type DatabaseExecutor = Kysely<DataBase> | Transaction<DataBase>;

export type TaskAvailability = "work" | "review" | "acceptance";

export type ListTaskFilter = {
  status?: TaskStatusValue[];
  availableFor?: TaskAvailability;
  storyId?: string;
};

export type ClaimResult = {
  claimId: string;
  taskId: string;
  principalId: string;
  state: "active";
  acquiredAt: number;
  expiresAt: number;
  taskStatus: TaskStatusValue;
};

type Clock = () => number;

type ReceiptInput = Record<string, unknown>;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

export class TaskCoordinationService {
  private readonly claimTtlMs: number;

  constructor(
    private readonly clock: Clock = () => Date.now(),
    claimTtlMs = Number(process.env.WACHA_CLAIM_TTL_MS ?? 30 * 60 * 1000),
  ) {
    if (!Number.isFinite(claimTtlMs) || claimTtlMs <= 0) {
      throw new RangeError("WACHA_CLAIM_TTL_MS must be a positive number");
    }
    this.claimTtlMs = claimTtlMs;
  }

  private requiredText(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new CoordinationError("INVALID_INPUT", `${field} is required`);
    }
    return trimmed;
  }

  private async requireRole(
    db: DatabaseExecutor,
    projectId: string,
    principalId: string,
    role: "worker" | "reviewer" | "manager",
  ): Promise<void> {
    const grant = await db
      .selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .where("role", "=", role)
      .executeTakeFirst();
    if (!grant) {
      throw new CoordinationError(
        "FORBIDDEN",
        `Principal ${principalId} does not have ${role} role for project ${projectId}`,
      );
    }
  }

  private async requireAnyRole(
    db: DatabaseExecutor,
    projectId: string,
    principalId: string,
  ): Promise<void> {
    const grant = await db
      .selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .executeTakeFirst();
    if (!grant) {
      throw new CoordinationError(
        "FORBIDDEN",
        `Principal ${principalId} has no role for project ${projectId}`,
      );
    }
  }

  async assertProjectAccess(principalId: string, projectId: string): Promise<void> {
    await this.requireAnyRole(DatabaseClient, projectId, principalId);
  }

  async assertProjectRole(
    principalId: string,
    projectId: string,
    role: "worker" | "reviewer" | "manager",
  ): Promise<void> {
    await this.requireRole(DatabaseClient, projectId, principalId, role);
  }

  async listProjects(principalId: string) {
    const projects = await DatabaseClient.selectFrom("project")
      .innerJoin("project_grant", "project_grant.project_id", "project.id")
      .select([
        "project.id as id",
        "project.name as name",
        "project.description as description",
        "project.basedir as basedir",
        "project.created_at as createdAt",
        "project.updated_at as updatedAt",
      ])
      .where("project_grant.principal_id", "=", principalId)
      .distinct()
      .orderBy("project.created_at", "asc")
      .execute();
    return { projects };
  }

  async listStories(principalId: string, projectId: string, status?: string) {
    await this.requireAnyRole(DatabaseClient, projectId, principalId);
    let query = DatabaseClient.selectFrom("story").selectAll().where("project_id", "=", projectId);
    if (status) query = query.where("status", "=", status as never);
    const rows = await query.orderBy("sort_order", "asc").orderBy("created_at", "asc").execute();
    return {
      stories: rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        status: row.status,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  async listTaskComments(principalId: string, taskId: string) {
    const task = await this.getTask(DatabaseClient, taskId);
    await this.requireAnyRole(DatabaseClient, task.project_id, principalId);
    const rows = await DatabaseClient.selectFrom("task_comment")
      .selectAll()
      .where("task_id", "=", taskId)
      .orderBy("created_at", "asc")
      .execute();
    return {
      comments: rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        body: row.body,
        author: row.author,
        principalId: row.principal_id,
        claimId: row.claim_id,
        createdAt: row.created_at,
      })),
    };
  }

  private async getTask(db: DatabaseExecutor, taskId: string) {
    const task = await db.selectFrom("task").selectAll().where("id", "=", taskId).executeTakeFirst();
    if (!task) {
      throw new CoordinationError("TASK_NOT_CLAIMABLE", `Task ${taskId} was not found`);
    }
    return task;
  }

  private async getActiveClaim(db: DatabaseExecutor, taskId: string) {
    return db
      .selectFrom("task_claim")
      .selectAll()
      .where("task_id", "=", taskId)
      .where("state", "=", "active")
      .executeTakeFirst();
  }

  private async appendChange(
    db: DatabaseExecutor,
    input: {
      projectId: string;
      type: string;
      entityId: string;
      principalId: string;
      claimId?: string | null;
      payload: Record<string, unknown>;
      occurredAt: number;
    },
  ): Promise<number> {
    const row = await db
      .insertInto("change_log")
      .values({
        project_id: input.projectId,
        type: input.type,
        entity_id: input.entityId,
        principal_id: input.principalId,
        claim_id: input.claimId ?? null,
        payload: JSON.stringify(input.payload),
        occurred_at: input.occurredAt,
      })
      .returning("cursor")
      .executeTakeFirstOrThrow();
    return Number(row.cursor);
  }

  private async expireClaim(
    db: DatabaseExecutor,
    claim: TaskClaimTable,
    projectId: string,
    observedBy: string,
    now: number,
  ): Promise<void> {
    await db
      .updateTable("task_claim")
      .set({ state: "expired", released_at: now, release_reason: "lease_expired" })
      .where("id", "=", claim.id)
      .where("state", "=", "active")
      .execute();
    await this.appendChange(db, {
      projectId,
      type: "CLAIM_EXPIRED",
      entityId: claim.task_id,
      principalId: observedBy,
      claimId: claim.id,
      payload: { claimPrincipalId: claim.principal_id, expiresAt: claim.expires_at },
      occurredAt: now,
    });
  }

  private async withReceipt<T>(
    db: Transaction<DataBase>,
    principalId: string,
    toolName: string,
    requestId: string,
    input: ReceiptInput,
    execute: () => Promise<T>,
  ): Promise<T> {
    const inputJson = JSON.stringify(canonicalize(input));
    const existing = await db
      .selectFrom("command_receipt")
      .selectAll()
      .where("principal_id", "=", principalId)
      .where("tool_name", "=", toolName)
      .where("request_id", "=", requestId)
      .executeTakeFirst();
    if (existing) {
      if (existing.input_json !== inputJson) {
        throw new CoordinationError(
          "IDEMPOTENCY_CONFLICT",
          `requestId ${requestId} was already used with different input`,
        );
      }
      return JSON.parse(existing.result_json) as T;
    }

    const result = await execute();
    await db
      .insertInto("command_receipt")
      .values({
        principal_id: principalId,
        tool_name: toolName,
        request_id: requestId,
        input_json: inputJson,
        result_json: JSON.stringify(result),
        created_at: this.clock(),
      })
      .execute();
    return result;
  }

  private claimResult(claim: TaskClaimTable, taskStatus: TaskStatusValue): ClaimResult {
    return {
      claimId: claim.id,
      taskId: claim.task_id,
      principalId: claim.principal_id,
      state: "active",
      acquiredAt: claim.acquired_at,
      expiresAt: claim.expires_at,
      taskStatus,
    };
  }

  private async insertClaim(
    db: DatabaseExecutor,
    taskId: string,
    principalId: string,
    now: number,
  ): Promise<TaskClaimTable> {
    const claim: TaskClaimTable = {
      id: crypto.randomUUID(),
      task_id: taskId,
      principal_id: principalId,
      state: "active",
      acquired_at: now,
      renewed_at: null,
      expires_at: now + this.claimTtlMs,
      released_at: null,
      release_reason: null,
    };
    try {
      await db.insertInto("task_claim").values(claim).execute();
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
        throw new CoordinationError("CLAIM_CONFLICT", `Task ${taskId} was claimed concurrently`);
      }
      throw error;
    }
    return claim;
  }

  private async latestCompleter(db: DatabaseExecutor, taskId: string): Promise<string | null> {
    const row = await db
      .selectFrom("change_log")
      .select("principal_id")
      .where("entity_id", "=", taskId)
      .where("type", "=", "TASK_COMPLETED")
      .orderBy("cursor", "desc")
      .executeTakeFirst();
    return row?.principal_id ?? null;
  }

  async listTasks(
    principalId: string,
    projectId: string,
    filter?: ListTaskFilter,
    limit?: number,
  ) {
    if (filter?.status && filter.availableFor) {
      throw new CoordinationError(
        "INVALID_FILTER_COMBINATION",
        "status and availableFor cannot be used together",
      );
    }
    await this.requireAnyRole(DatabaseClient, projectId, principalId);

    const now = this.clock();
    const [tasks, stories, claims, completionRows] = await Promise.all([
      DatabaseClient.selectFrom("task").selectAll().where("project_id", "=", projectId).execute(),
      DatabaseClient.selectFrom("story")
        .select(["id", "sort_order"])
        .where("project_id", "=", projectId)
        .execute(),
      DatabaseClient.selectFrom("task_claim")
        .selectAll()
        .where("state", "=", "active")
        .where(
          "task_id",
          "in",
          DatabaseClient.selectFrom("task").select("id").where("project_id", "=", projectId),
        )
        .execute(),
      DatabaseClient.selectFrom("change_log")
        .select(["entity_id", "principal_id", "cursor"])
        .where("project_id", "=", projectId)
        .where("type", "=", "TASK_COMPLETED")
        .orderBy("cursor", "desc")
        .execute(),
    ]);
    const storyOrders = new Map(stories.map((story) => [story.id, story.sort_order]));
    const activeClaims = new Map(claims.map((claim) => [claim.task_id, claim]));
    const latestCompleters = new Map<string, string>();
    for (const row of completionRows) {
      if (!latestCompleters.has(row.entity_id)) latestCompleters.set(row.entity_id, row.principal_id);
    }
    const roles = await DatabaseClient.selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .execute();
    const roleSet = new Set(roles.map((row) => row.role));

    const ordered = [...tasks].sort((a, b) => {
      const aPrimary = a.story_id ? (storyOrders.get(a.story_id) ?? Number.MAX_SAFE_INTEGER) : a.sort_order;
      const bPrimary = b.story_id ? (storyOrders.get(b.story_id) ?? Number.MAX_SAFE_INTEGER) : b.sort_order;
      return aPrimary - bPrimary || a.sort_order - b.sort_order || a.created_at - b.created_at;
    });

    const isAvailable = (task: (typeof tasks)[number]) => {
      const claim = activeClaims.get(task.id);
      const hasUnexpiredClaim = claim !== undefined && claim.expires_at > now;
      const latestCompleter = latestCompleters.get(task.id) ?? null;
      switch (filter?.availableFor) {
        case "work":
          return (
            roleSet.has(ProjectRole.WORKER) &&
            (((task.status === TaskStatus.TODO || task.status === TaskStatus.REJECTED) &&
              !hasUnexpiredClaim) ||
              (task.status === TaskStatus.DOING && claim !== undefined && claim.expires_at <= now))
          );
        case "review":
          return (
            roleSet.has(ProjectRole.REVIEWER) &&
            task.status === TaskStatus.IN_REVIEW &&
            !hasUnexpiredClaim &&
            latestCompleter !== principalId
          );
        case "acceptance":
          return (
            roleSet.has(ProjectRole.MANAGER) &&
            (task.status === TaskStatus.IN_REVIEW || task.status === TaskStatus.WAIT_ACCEPT) &&
            !hasUnexpiredClaim &&
            latestCompleter !== principalId
          );
        default:
          return true;
      }
    };

    let selected = ordered.filter((task) => {
      if (filter?.storyId && task.story_id !== filter.storyId) return false;
      if (filter?.status && !filter.status.includes(task.status as TaskStatusValue)) return false;
      return isAvailable(task);
    });
    if (limit !== undefined) selected = selected.slice(0, limit);

    const taskDtos = selected.map((task) => {
      const claim = activeClaims.get(task.id);
      const unexpiredClaim = claim && claim.expires_at > now ? claim : null;
      return {
        id: task.id,
        projectId: task.project_id,
        storyId: task.story_id,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: unexpiredClaim?.principal_id ?? null,
        rejectReason: task.reject_reason,
        resumeSourceStatus: task.resume_source_status,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        sortOrder: task.sort_order,
        activeClaim: unexpiredClaim
          ? {
              claimId: unexpiredClaim.id,
              principalId: unexpiredClaim.principal_id,
              expiresAt: unexpiredClaim.expires_at,
            }
          : null,
        reclaimable: task.status === TaskStatus.DOING && claim !== undefined && claim.expires_at <= now,
      };
    });

    const byStatus = Object.fromEntries(
      Object.values(TaskStatus).map((status) => [
        status,
        tasks.filter((task) => task.status === status).length,
      ]),
    ) as Record<TaskStatusValue, number>;
    return {
      summary: {
        total: tasks.length,
        byStatus,
        lastUpdatedAt: tasks.reduce<number | null>(
          (max, task) => (max === null || task.updated_at > max ? task.updated_at : max),
          null,
        ),
      },
      tasks: taskDtos,
    };
  }

  async claimTask(principalId: string, taskId: string, requestId: string): Promise<ClaimResult> {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "claim_task", requestId, { taskId }, async () => {
        const now = this.clock();
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.WORKER);
        const currentClaim = await this.getActiveClaim(db, taskId);
        let reclaimingExpiredWork = false;
        if (currentClaim) {
          if (currentClaim.expires_at > now) {
            throw new CoordinationError("CLAIM_CONFLICT", `Task ${taskId} already has an active Claim`);
          }
          reclaimingExpiredWork = task.status === TaskStatus.DOING;
          await this.expireClaim(db, currentClaim, task.project_id, principalId, now);
        }
        if (
          task.status !== TaskStatus.TODO &&
          task.status !== TaskStatus.REJECTED &&
          !(task.status === TaskStatus.DOING && reclaimingExpiredWork)
        ) {
          throw new CoordinationError("TASK_NOT_CLAIMABLE", `Task ${taskId} is not available for work`);
        }
        const fromStatus = task.status;
        const claim = await this.insertClaim(db, taskId, principalId, now);
        await db
          .updateTable("task")
          .set({
            status: TaskStatus.DOING,
            assignee: null,
            resume_source_status:
              fromStatus === TaskStatus.REJECTED ? TaskStatus.REJECTED : TaskStatus.TODO,
            updated_at: now,
          })
          .where("id", "=", taskId)
          .execute();
        if (task.story_id) {
          const story = await db
            .selectFrom("story")
            .select("status")
            .where("id", "=", task.story_id)
            .executeTakeFirst();
          if (story?.status === StoryStatus.TODO) {
            await db
              .updateTable("story")
              .set({ status: StoryStatus.DOING, updated_at: now })
              .where("id", "=", task.story_id)
              .execute();
            await this.appendChange(db, {
              projectId: task.project_id,
              type: "STORY_STARTED",
              entityId: task.story_id,
              principalId,
              claimId: claim.id,
              payload: { fromStatus: StoryStatus.TODO, toStatus: StoryStatus.DOING },
              occurredAt: now,
            });
          }
        }
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_CLAIMED",
          entityId: taskId,
          principalId,
          claimId: claim.id,
          payload: {
            claimCommand: "claim_task",
            fromStatus,
            toStatus: TaskStatus.DOING,
            path: reclaimingExpiredWork ? "expired_claim_recovery" : "normal",
          },
          occurredAt: now,
        });
        return this.claimResult(claim, TaskStatus.DOING);
      }),
    );
  }

  async claimReview(principalId: string, taskId: string, requestId: string): Promise<ClaimResult> {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "claim_review", requestId, { taskId }, async () => {
        const now = this.clock();
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
        const currentClaim = await this.getActiveClaim(db, taskId);
        if (currentClaim) {
          if (currentClaim.expires_at > now) {
            throw new CoordinationError("CLAIM_CONFLICT", `Task ${taskId} already has an active Claim`);
          }
          await this.expireClaim(db, currentClaim, task.project_id, principalId, now);
        }
        if (task.status !== TaskStatus.IN_REVIEW) {
          throw new CoordinationError("TASK_NOT_CLAIMABLE", `Task ${taskId} is not available for review`);
        }
        if ((await this.latestCompleter(db, taskId)) === principalId) {
          throw new CoordinationError(
            "SELF_REVIEW_NOT_ALLOWED",
            `Principal ${principalId} cannot review its own completed work`,
          );
        }
        const claim = await this.insertClaim(db, taskId, principalId, now);
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_CLAIMED",
          entityId: taskId,
          principalId,
          claimId: claim.id,
          payload: { claimCommand: "claim_review", fromStatus: task.status, toStatus: task.status },
          occurredAt: now,
        });
        return this.claimResult(claim, TaskStatus.IN_REVIEW);
      }),
    );
  }

  async claimAcceptance(
    principalId: string,
    taskId: string,
    requestId: string,
  ): Promise<ClaimResult> {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "claim_acceptance", requestId, { taskId }, async () => {
        const now = this.clock();
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
        const currentClaim = await this.getActiveClaim(db, taskId);
        if (currentClaim) {
          if (currentClaim.expires_at > now) {
            throw new CoordinationError("CLAIM_CONFLICT", `Task ${taskId} already has an active Claim`);
          }
          await this.expireClaim(db, currentClaim, task.project_id, principalId, now);
        }
        if (task.status !== TaskStatus.IN_REVIEW && task.status !== TaskStatus.WAIT_ACCEPT) {
          throw new CoordinationError(
            "TASK_NOT_CLAIMABLE",
            `Task ${taskId} is not available for acceptance`,
          );
        }
        if ((await this.latestCompleter(db, taskId)) === principalId) {
          throw new CoordinationError(
            "SELF_ACCEPTANCE_NOT_ALLOWED",
            `Principal ${principalId} cannot accept its own completed work`,
          );
        }
        const fromStatus = task.status;
        const claim = await this.insertClaim(db, taskId, principalId, now);
        if (fromStatus === TaskStatus.IN_REVIEW) {
          await db
            .updateTable("task")
            .set({ status: TaskStatus.WAIT_ACCEPT, updated_at: now })
            .where("id", "=", taskId)
            .execute();
        }
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_CLAIMED",
          entityId: taskId,
          principalId,
          claimId: claim.id,
          payload: {
            claimCommand: "claim_acceptance",
            fromStatus,
            toStatus: TaskStatus.WAIT_ACCEPT,
            path:
              fromStatus === TaskStatus.IN_REVIEW ? "manager_direct_review" : "reviewer_approved",
          },
          occurredAt: now,
        });
        return this.claimResult(claim, TaskStatus.WAIT_ACCEPT);
      }),
    );
  }

  private async assertCurrentClaim(
    db: DatabaseExecutor,
    principalId: string,
    taskId: string,
    claimId: string,
  ) {
    const claim = await db
      .selectFrom("task_claim")
      .selectAll()
      .where("id", "=", claimId)
      .executeTakeFirst();
    if (!claim || claim.task_id !== taskId) {
      throw new CoordinationError("CLAIM_NOT_FOUND", `Claim ${claimId} was not found for Task ${taskId}`);
    }
    if (claim.principal_id !== principalId) {
      throw new CoordinationError("CLAIM_NOT_OWNED", `Claim ${claimId} belongs to another Principal`);
    }
    if (claim.state !== "active" || claim.expires_at <= this.clock()) {
      throw new CoordinationError("CLAIM_EXPIRED", `Claim ${claimId} is no longer active`);
    }
    const current = await this.getActiveClaim(db, taskId);
    if (!current || current.id !== claimId) {
      throw new CoordinationError("CLAIM_EXPIRED", `Claim ${claimId} is not the current Task Claim`);
    }
    return claim;
  }

  async renewClaim(principalId: string, claimId: string) {
    return DatabaseClient.transaction().execute(async (db) => {
      const claim = await db.selectFrom("task_claim").selectAll().where("id", "=", claimId).executeTakeFirst();
      if (!claim) throw new CoordinationError("CLAIM_NOT_FOUND", `Claim ${claimId} was not found`);
      await this.assertCurrentClaim(db, principalId, claim.task_id, claimId);
      const now = this.clock();
      const expiresAt = now + this.claimTtlMs;
      await db
        .updateTable("task_claim")
        .set({ renewed_at: now, expires_at: expiresAt })
        .where("id", "=", claimId)
        .execute();
      return { claimId, taskId: claim.task_id, renewedAt: now, expiresAt };
    });
  }

  async releaseClaim(
    principalId: string,
    claimId: string,
    reason: string,
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "release_claim", requestId, { claimId, reason }, async () => {
        const claim = await db.selectFrom("task_claim").selectAll().where("id", "=", claimId).executeTakeFirst();
        if (!claim) throw new CoordinationError("CLAIM_NOT_FOUND", `Claim ${claimId} was not found`);
        await this.assertCurrentClaim(db, principalId, claim.task_id, claimId);
        const task = await this.getTask(db, claim.task_id);
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
          throw new CoordinationError("INVALID_TASK_STATUS", "Release reason is required");
        }
        const now = this.clock();
        let taskStatus = task.status as TaskStatusValue;
        if (task.status === TaskStatus.DOING) {
          taskStatus = TaskStatus.TODO;
          await db
            .updateTable("task")
            .set({
              status: TaskStatus.TODO,
              assignee: null,
              resume_source_status: null,
              updated_at: now,
            })
            .where("id", "=", task.id)
            .execute();
        }
        await db
          .updateTable("task_claim")
          .set({ state: "released", released_at: now, release_reason: trimmedReason })
          .where("id", "=", claimId)
          .execute();
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "CLAIM_RELEASED",
          entityId: task.id,
          principalId,
          claimId,
          payload: { reason: trimmedReason, taskStatus },
          occurredAt: now,
        });
        return { claimId, taskId: task.id, state: "released" as const, taskStatus };
      }),
    );
  }

  async addTaskComment(
    principalId: string,
    taskId: string,
    claimId: string,
    body: string,
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(
        db,
        principalId,
        "add_task_comment",
        requestId,
        { taskId, claimId, body },
        async () => {
          await this.assertCurrentClaim(db, principalId, taskId, claimId);
          const trimmedBody = body.trim();
          if (!trimmedBody) {
            throw new CoordinationError("INVALID_TASK_STATUS", "Comment body is required");
          }
          const now = this.clock();
          const id = crypto.randomUUID();
          await db
            .insertInto("task_comment")
            .values({
              id,
              task_id: taskId,
              body: trimmedBody,
              author: principalId,
              session_id: null,
              principal_id: principalId,
              claim_id: claimId,
              created_at: now,
            })
            .execute();
          return {
            comment: {
              id,
              taskId,
              body: trimmedBody,
              author: principalId,
              principalId,
              claimId,
              createdAt: now,
            },
          };
        },
      ),
    );
  }

  async completeTask(principalId: string, taskId: string, claimId: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "complete_task", requestId, { taskId, claimId }, async () => {
        const claim = await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.WORKER);
        if (task.status !== TaskStatus.DOING) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not doing`);
        }
        const comment = await db
          .selectFrom("task_comment")
          .select("id")
          .where("task_id", "=", taskId)
          .where("claim_id", "=", claimId)
          .where("principal_id", "=", principalId)
          .executeTakeFirst();
        if (!comment) {
          throw new CoordinationError(
            "INVALID_TASK_STATUS",
            "Record implementation and verification notes with add_task_comment before complete_task",
          );
        }
        const now = this.clock();
        await db
          .updateTable("task")
          .set({
            status: TaskStatus.IN_REVIEW,
            assignee: null,
            resume_source_status: null,
            updated_at: now,
          })
          .where("id", "=", taskId)
          .execute();
        await db
          .updateTable("task_claim")
          .set({ state: "completed", released_at: now, release_reason: "task_completed" })
          .where("id", "=", claim.id)
          .execute();
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_COMPLETED",
          entityId: taskId,
          principalId,
          claimId,
          payload: { fromStatus: TaskStatus.DOING, toStatus: TaskStatus.IN_REVIEW },
          occurredAt: now,
        });
        return { taskId, claimId, status: TaskStatus.IN_REVIEW };
      }),
    );
  }

  async reviewedTask(principalId: string, taskId: string, claimId: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "reviewed_task", requestId, { taskId, claimId }, async () => {
        await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
        if (task.status !== TaskStatus.IN_REVIEW) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not in_review`);
        }
        const now = this.clock();
        await db
          .updateTable("task")
          .set({ status: TaskStatus.WAIT_ACCEPT, updated_at: now })
          .where("id", "=", taskId)
          .execute();
        await db
          .updateTable("task_claim")
          .set({ state: "completed", released_at: now, release_reason: "task_reviewed" })
          .where("id", "=", claimId)
          .execute();
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_REVIEWED",
          entityId: taskId,
          principalId,
          claimId,
          payload: { fromStatus: TaskStatus.IN_REVIEW, toStatus: TaskStatus.WAIT_ACCEPT },
          occurredAt: now,
        });
        return { taskId, claimId, status: TaskStatus.WAIT_ACCEPT };
      }),
    );
  }

  private async syncStoryAfterAcceptance(db: DatabaseExecutor, storyId: string | null, now: number) {
    if (!storyId) return;
    const unsettled = await db
      .selectFrom("task")
      .select("id")
      .where("story_id", "=", storyId)
      .where("status", "not in", [TaskStatus.ACCEPTED, TaskStatus.CANCELED])
      .executeTakeFirst();
    if (!unsettled) {
      await db
        .updateTable("story")
        .set({ status: "done", updated_at: now })
        .where("id", "=", storyId)
        .where("status", "=", "doing")
        .execute();
    }
  }

  async acceptTask(principalId: string, taskId: string, claimId: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "accept_task", requestId, { taskId, claimId }, async () => {
        await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
        if (task.status !== TaskStatus.WAIT_ACCEPT) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not wait_accept`);
        }
        const now = this.clock();
        await db
          .updateTable("task")
          .set({
            status: TaskStatus.ACCEPTED,
            reject_reason: null,
            resume_source_status: null,
            updated_at: now,
          })
          .where("id", "=", taskId)
          .execute();
        await db
          .updateTable("task_claim")
          .set({ state: "completed", released_at: now, release_reason: "task_accepted" })
          .where("id", "=", claimId)
          .execute();
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_ACCEPTED",
          entityId: taskId,
          principalId,
          claimId,
          payload: { fromStatus: TaskStatus.WAIT_ACCEPT, toStatus: TaskStatus.ACCEPTED },
          occurredAt: now,
        });
        await this.syncStoryAfterAcceptance(db, task.story_id, now);
        return { taskId, claimId, status: TaskStatus.ACCEPTED };
      }),
    );
  }

  async rejectTask(
    principalId: string,
    taskId: string,
    claimId: string,
    reason: string,
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(
        db,
        principalId,
        "reject_task",
        requestId,
        { taskId, claimId, reason },
        async () => {
          await this.assertCurrentClaim(db, principalId, taskId, claimId);
          const task = await this.getTask(db, taskId);
          if (task.status === TaskStatus.IN_REVIEW) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
          } else if (task.status === TaskStatus.WAIT_ACCEPT) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
          } else {
            throw new CoordinationError(
              "INVALID_TASK_STATUS",
              `Task ${taskId} is not reviewable`,
            );
          }
          const trimmedReason = reason.trim();
          if (!trimmedReason) {
            throw new CoordinationError("INVALID_TASK_STATUS", "Reject reason is required");
          }
          const now = this.clock();
          const fromStatus = task.status;
          await db
            .updateTable("task")
            .set({
              status: TaskStatus.REJECTED,
              reject_reason: trimmedReason,
              resume_source_status: null,
              updated_at: now,
            })
            .where("id", "=", taskId)
            .execute();
          await db
            .updateTable("task_claim")
            .set({ state: "completed", released_at: now, release_reason: "task_rejected" })
            .where("id", "=", claimId)
            .execute();
          await this.appendChange(db, {
            projectId: task.project_id,
            type: "TASK_REJECTED",
            entityId: taskId,
            principalId,
            claimId,
            payload: { fromStatus, toStatus: TaskStatus.REJECTED, reason: trimmedReason },
            occurredAt: now,
          });
          return { taskId, claimId, status: TaskStatus.REJECTED, rejectReason: trimmedReason };
        },
      ),
    );
  }

  async cancelTask(principalId: string, taskId: string, reason: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "cancel_task", requestId, { taskId, reason }, async () => {
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
        if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.DOING) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not cancelable`);
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
          throw new CoordinationError("INVALID_TASK_STATUS", "Cancel reason is required");
        }
        const now = this.clock();
        const claim = await this.getActiveClaim(db, taskId);
        if (claim) {
          await db
            .updateTable("task_claim")
            .set({ state: "released", released_at: now, release_reason: "task_canceled" })
            .where("id", "=", claim.id)
            .execute();
        }
        await db
          .updateTable("task")
          .set({
            status: TaskStatus.CANCELED,
            assignee: null,
            resume_source_status: null,
            updated_at: now,
          })
          .where("id", "=", taskId)
          .execute();
        await this.appendChange(db, {
          projectId: task.project_id,
          type: "TASK_CANCELED",
          entityId: taskId,
          principalId,
          claimId: claim?.id ?? null,
          payload: { fromStatus: task.status, toStatus: TaskStatus.CANCELED, reason: trimmedReason },
          occurredAt: now,
        });
        return { taskId, status: TaskStatus.CANCELED, reason: trimmedReason };
      }),
    );
  }

  async issueTask(
    principalId: string,
    input: { projectId: string; storyId?: string; title: string; description?: string },
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "issue_task", requestId, input, async () => {
        await this.requireRole(db, input.projectId, principalId, ProjectRole.MANAGER);
        const title = this.requiredText(input.title, "Task title");
        if (input.storyId) {
          const story = await db
            .selectFrom("story")
            .select("id")
            .where("id", "=", input.storyId)
            .where("project_id", "=", input.projectId)
            .executeTakeFirst();
          if (!story) {
            throw new CoordinationError("INVALID_INPUT", "Story was not found in the Project");
          }
        }
        const now = this.clock();
        const maxRow = await db
          .selectFrom("task")
          .select(({ fn }) => fn.max("sort_order").as("max_sort_order"))
          .where("project_id", "=", input.projectId)
          .executeTakeFirst();
        const id = crypto.randomUUID();
        const sortOrder = (maxRow?.max_sort_order ?? 0) + 1;
        await db
          .insertInto("task")
          .values({
            id,
            project_id: input.projectId,
            story_id: input.storyId ?? null,
            title,
            description: input.description?.trim() || null,
            status: TaskStatus.TODO,
            assignee: null,
            reject_reason: null,
            resume_source_status: null,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
          })
          .execute();
        await this.appendChange(db, {
          projectId: input.projectId,
          type: "TASK_CREATED",
          entityId: id,
          principalId,
          payload: { status: TaskStatus.TODO, storyId: input.storyId ?? null },
          occurredAt: now,
        });
        return {
          id,
          projectId: input.projectId,
          storyId: input.storyId ?? null,
          title,
          description: input.description?.trim() || null,
          status: TaskStatus.TODO,
          sortOrder,
          createdAt: now,
          updatedAt: now,
        };
      }),
    );
  }

  async editTask(
    principalId: string,
    input: {
      projectId: string;
      taskId: string;
      title: string;
      description?: string;
      sortOrder?: number;
    },
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "edit_task", requestId, input, async () => {
        await this.requireRole(db, input.projectId, principalId, ProjectRole.MANAGER);
        const task = await this.getTask(db, input.taskId);
        if (task.project_id !== input.projectId) {
          throw new CoordinationError("INVALID_TASK_STATUS", "Task does not belong to the Project");
        }
        const title = this.requiredText(input.title, "Task title");
        const now = this.clock();
        await db
          .updateTable("task")
          .set({
            title,
            description: input.description?.trim() || null,
            ...(input.sortOrder === undefined ? {} : { sort_order: input.sortOrder }),
            updated_at: now,
          })
          .where("id", "=", input.taskId)
          .execute();
        const updated = await this.getTask(db, input.taskId);
        return {
          id: updated.id,
          projectId: updated.project_id,
          storyId: updated.story_id,
          title: updated.title,
          description: updated.description,
          status: updated.status,
          sortOrder: updated.sort_order,
          updatedAt: updated.updated_at,
        };
      }),
    );
  }

  async issueStory(
    principalId: string,
    input: { projectId: string; title: string; description?: string },
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "issue_story", requestId, input, async () => {
        await this.requireRole(db, input.projectId, principalId, ProjectRole.MANAGER);
        const title = this.requiredText(input.title, "Story title");
        const maxRow = await db
          .selectFrom("story")
          .select(({ fn }) => fn.max("sort_order").as("max_sort_order"))
          .where("project_id", "=", input.projectId)
          .executeTakeFirst();
        const now = this.clock();
        const id = crypto.randomUUID();
        const sortOrder = (maxRow?.max_sort_order ?? 0) + 1;
        await db
          .insertInto("story")
          .values({
            id,
            project_id: input.projectId,
            title,
            description: input.description?.trim() || null,
            status: StoryStatus.TODO,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
          })
          .execute();
        await this.appendChange(db, {
          projectId: input.projectId,
          type: "STORY_CREATED",
          entityId: id,
          principalId,
          payload: { status: StoryStatus.TODO },
          occurredAt: now,
        });
        return {
          id,
          projectId: input.projectId,
          title,
          description: input.description?.trim() || null,
          status: StoryStatus.TODO,
          sortOrder,
          createdAt: now,
          updatedAt: now,
          requiredNextTool: "issue_task" as const,
        };
      }),
    );
  }

  async editStory(
    principalId: string,
    input: {
      projectId: string;
      storyId: string;
      title: string;
      description?: string;
      sortOrder?: number;
    },
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "edit_story", requestId, input, async () => {
        await this.requireRole(db, input.projectId, principalId, ProjectRole.MANAGER);
        const story = await db
          .selectFrom("story")
          .selectAll()
          .where("id", "=", input.storyId)
          .where("project_id", "=", input.projectId)
          .executeTakeFirst();
        if (!story) {
          throw new CoordinationError("INVALID_TASK_STATUS", "Story was not found in the Project");
        }
        const title = this.requiredText(input.title, "Story title");
        const now = this.clock();
        await db
          .updateTable("story")
          .set({
            title,
            description: input.description?.trim() || null,
            ...(input.sortOrder === undefined ? {} : { sort_order: input.sortOrder }),
            updated_at: now,
          })
          .where("id", "=", input.storyId)
          .execute();
        return {
          id: input.storyId,
          projectId: input.projectId,
          title,
          description: input.description?.trim() || null,
          status: story.status,
          sortOrder: input.sortOrder ?? story.sort_order,
          updatedAt: now,
        };
      }),
    );
  }

  async completeStory(principalId: string, storyId: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "complete_story", requestId, { storyId }, async () => {
        const story = await db.selectFrom("story").selectAll().where("id", "=", storyId).executeTakeFirst();
        if (!story) throw new CoordinationError("INVALID_TASK_STATUS", "Story was not found");
        await this.requireRole(db, story.project_id, principalId, ProjectRole.MANAGER);
        if (story.status !== StoryStatus.DOING) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Story ${storyId} is not doing`);
        }
        const unsettled = await db
          .selectFrom("task")
          .select("id")
          .where("story_id", "=", storyId)
          .where("status", "not in", [TaskStatus.ACCEPTED, TaskStatus.CANCELED])
          .executeTakeFirst();
        if (unsettled) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Story ${storyId} has unsettled Tasks`);
        }
        const now = this.clock();
        await db
          .updateTable("story")
          .set({ status: StoryStatus.DONE, updated_at: now })
          .where("id", "=", storyId)
          .execute();
        await this.appendChange(db, {
          projectId: story.project_id,
          type: "STORY_COMPLETED",
          entityId: storyId,
          principalId,
          payload: { fromStatus: StoryStatus.DOING, toStatus: StoryStatus.DONE },
          occurredAt: now,
        });
        return { storyId, status: StoryStatus.DONE };
      }),
    );
  }

  async cancelStory(principalId: string, storyId: string, reason: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "cancel_story", requestId, { storyId, reason }, async () => {
        const story = await db.selectFrom("story").selectAll().where("id", "=", storyId).executeTakeFirst();
        if (!story) throw new CoordinationError("INVALID_TASK_STATUS", "Story was not found");
        await this.requireRole(db, story.project_id, principalId, ProjectRole.MANAGER);
        if (story.status !== StoryStatus.DOING) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Story ${storyId} is not doing`);
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
          throw new CoordinationError("INVALID_TASK_STATUS", "Cancel reason is required");
        }
        const now = this.clock();
        await db
          .updateTable("story")
          .set({ status: StoryStatus.CANCELED, updated_at: now })
          .where("id", "=", storyId)
          .execute();
        await this.appendChange(db, {
          projectId: story.project_id,
          type: "STORY_CANCELED",
          entityId: storyId,
          principalId,
          payload: { fromStatus: StoryStatus.DOING, toStatus: StoryStatus.CANCELED, reason: trimmedReason },
          occurredAt: now,
        });
        return { storyId, status: StoryStatus.CANCELED, reason: trimmedReason };
      }),
    );
  }

  async listChanges(principalId: string, projectId: string, afterCursor = 0, limit = 100) {
    await this.requireAnyRole(DatabaseClient, projectId, principalId);
    const rows = await DatabaseClient.selectFrom("change_log")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("cursor", ">", afterCursor)
      .orderBy("cursor", "asc")
      .limit(limit)
      .execute();
    const changes = rows.map((row) => ({
      cursor: Number(row.cursor),
      projectId: row.project_id,
      type: row.type,
      entityId: row.entity_id,
      principalId: row.principal_id,
      claimId: row.claim_id,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      occurredAt: row.occurred_at,
    }));
    return {
      changes,
      nextCursor: changes.at(-1)?.cursor ?? afterCursor,
    };
  }
}
