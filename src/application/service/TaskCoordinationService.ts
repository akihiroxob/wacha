import type { Kysely, Transaction } from "kysely";

import { CoordinationError } from "@application/error/CoordinationError.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "@constants/TaskStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import type { DataBase } from "@database/schema/index.ts";
import type { TaskClaimTable } from "@database/schema/taskClaim.ts";

import type { PullRequestGateway, PullRequestSnapshot, RepositoryWorkflow } from "@domain/model/PullRequest.ts";
import { checksPassed } from "@domain/model/PullRequest.ts";
import { GitHubPullRequestGateway } from "../../infrastructure/github/GitHubPullRequestGateway.ts";

export type AcceptanceVerification = { mergeSha: string; evidence: string };

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
type ActivityActorRole = "worker" | "reviewer" | "manager" | "operator" | "system";

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
    private readonly pullRequests: PullRequestGateway = new GitHubPullRequestGateway(),
  ) {
    if (!Number.isFinite(claimTtlMs) || claimTtlMs <= 0) {
      throw new RangeError("WACHA_CLAIM_TTL_MS must be a positive number");
    }
    this.claimTtlMs = claimTtlMs;
  }

  async getRepositoryWorkflow(projectId: string, db: DatabaseExecutor = DatabaseClient): Promise<RepositoryWorkflow | null> {
    const row = await db.selectFrom("project_workflow").selectAll().where("project_id", "=", projectId).executeTakeFirst();
    return row ? { repository: row.repository, baseBranch: row.base_branch, requiredChecks: JSON.parse(row.required_checks) } : null;
  }

  // Human administration only; not exposed as an Agent MCP tool.
  async configureRepositoryWorkflow(projectId: string, input: RepositoryWorkflow | null) {
    if (input && (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(input.repository) ||
      !input.baseBranch.trim() || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(input.baseBranch) ||
      input.baseBranch.includes("..") || input.baseBranch.includes("//") || /[/.]$|\.lock$/.test(input.baseBranch) || !Array.isArray(input.requiredChecks) ||
      input.requiredChecks.some((name) => typeof name !== "string" || !name.trim()))) {
      throw new CoordinationError("INVALID_INPUT", "repository, baseBranch and a requiredChecks array are required");
    }
    if (input) input = { ...input, repository: input.repository.toLowerCase(), baseBranch: input.baseBranch.trim(), requiredChecks: [...new Set(input.requiredChecks.map((name) => name.trim()))] };
    return DatabaseClient.transaction().execute(async (db) => {
      const current = await this.getRepositoryWorkflow(projectId, db);
      const active = await db.selectFrom("task").select("id").where("project_id", "=", projectId)
        .where("status", "in", [TaskStatus.DOING, TaskStatus.IN_REVIEW, TaskStatus.WAIT_ACCEPT]).executeTakeFirst();
      if (active) throw new CoordinationError("INVALID_TASK_STATUS", "Finish or reject active work before changing repository workflow");
      const unsettled = await db.selectFrom("task_pull_request").innerJoin("task", "task.id", "task_pull_request.task_id")
        .select("task_pull_request.id").where("task.project_id", "=", projectId)
        .where("task.status", "not in", [TaskStatus.ACCEPTED, TaskStatus.CANCELED]).executeTakeFirst();
      if (unsettled && JSON.stringify(current) !== JSON.stringify(input)) {
        throw new CoordinationError("INVALID_TASK_STATUS", "Cannot change workflow while unsettled Tasks have PR history");
      }
      if (input) {
        await db.insertInto("project_workflow").values({ project_id: projectId, repository: input.repository,
          base_branch: input.baseBranch.trim(), required_checks: JSON.stringify([...new Set(input.requiredChecks.map((name) => name.trim()))]) })
          .onConflict((conflict) => conflict.column("project_id").doUpdateSet({ repository: input.repository,
            base_branch: input.baseBranch.trim(), required_checks: JSON.stringify([...new Set(input.requiredChecks.map((name) => name.trim()))]) })).execute();
      } else {
        await db.deleteFrom("project_workflow").where("project_id", "=", projectId).execute();
      }
      await this.appendChange(db, { projectId, type: "PROJECT_WORKFLOW_CONFIGURED", entityId: projectId,
        principalId: "system:web-ui", payload: { actorRole: "operator", workflow: input }, occurredAt: this.clock() });
      return { workflow: input };
    });
  }

  async getTaskPullRequests(taskId: string, db: DatabaseExecutor = DatabaseClient) {
    const rows = await db.selectFrom("task_pull_request").selectAll().where("task_id", "=", taskId).orderBy("id", "asc").execute();
    return rows.map((row) => ({ id: row.id, taskId: row.task_id, workClaimId: row.work_claim_id,
      ...JSON.parse(row.snapshot) as PullRequestSnapshot, reviewedHeadSha: row.reviewed_head_sha, reviewedCommentId: row.reviewed_comment_id,
      acceptedMergeSha: row.accepted_merge_sha, acceptanceEvidence: row.acceptance_evidence,
      createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async listTaskPullRequests(principalId: string, taskId: string) {
    const task = await this.getTask(DatabaseClient, taskId);
    await this.requireAnyRole(DatabaseClient, task.project_id, principalId);
    return { pullRequests: await this.getTaskPullRequests(taskId) };
  }

  private async prefetchPullRequest(principalId: string, taskId: string, claimId: string | null,
    toolName: string, requestId: string, role: "worker" | "reviewer" | "manager" | "operator", number?: number) {
    // Receipt lookup permits recovery after a successful transition whose response was lost.
    if (requestId && await DatabaseClient.selectFrom("command_receipt").select("request_id")
      .where("principal_id", "=", principalId).where("tool_name", "=", toolName).where("request_id", "=", requestId).executeTakeFirst()) return null;
    const task = await this.getTask(DatabaseClient, taskId);
    if (role !== "operator") {
      await this.requireRole(DatabaseClient, task.project_id, principalId, role);
      if (claimId) await this.assertCurrentClaim(DatabaseClient, principalId, taskId, claimId);
    }
    if (task.completion_mode === "evidence") {
      if (toolName === "register_task_pull_request") throw new CoordinationError("INVALID_INPUT", "Evidence Tasks do not register PRs");
      return null;
    }
    const workflow = await this.getRepositoryWorkflow(task.project_id);
    if (!workflow) return null;
    const rows = await this.getTaskPullRequests(taskId);
    const latest = rows.at(-1);
    const targetNumber = number ?? latest?.number;
    if (targetNumber === undefined) throw new CoordinationError("PULL_REQUEST_REQUIRED", "Register a PR before completing this Task");
    // Network reads run outside SQLite transactions; claims and facts are rechecked on commit.
    const current = await this.pullRequests.getPullRequest(workflow.repository, targetNumber);
    const previous = latest && number !== undefined && latest.number !== number && latest.state === "open"
      ? await this.pullRequests.getPullRequest(latest.repository, latest.number) : null;
    return { current, previous };
  }

  private validateRepository(pr: PullRequestSnapshot, workflow: RepositoryWorkflow) {
    if (pr.repository.toLowerCase() !== workflow.repository.toLowerCase() || pr.baseBranch !== workflow.baseBranch) {
      throw new CoordinationError("PULL_REQUEST_NOT_READY", "PR repository or base branch does not match the Project workflow");
    }
  }

  async registerTaskPullRequest(principalId: string, taskId: string, claimId: string, number: number, requestId: string) {
    const prefetched = await this.prefetchPullRequest(principalId, taskId, claimId, "register_task_pull_request", requestId, "worker", number);
    return DatabaseClient.transaction().execute(async (db) => this.withReceipt(db, principalId,
      "register_task_pull_request", requestId, { taskId, claimId, number }, async () => {
        await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.WORKER);
        if (task.status !== TaskStatus.DOING) throw new CoordinationError("INVALID_TASK_STATUS", "Task is not doing");
        if (task.completion_mode === "evidence") throw new CoordinationError("INVALID_INPUT", "Evidence Tasks do not register PRs");
        const workflow = await this.getRepositoryWorkflow(task.project_id, db);
        if (!workflow) throw new CoordinationError("INVALID_INPUT", "Project has no GitHub workflow");
        const pr = prefetched?.current;
        if (!pr || pr.number !== number) throw new CoordinationError("PULL_REQUEST_NOT_READY", "PR facts changed; retry registration");
        this.validateRepository(pr, workflow);
        if (pr.state !== "open" || pr.draft) throw new CoordinationError("PULL_REQUEST_NOT_READY", "An open, ready PR is required; merged rework needs a new PR");
        const old = await db.selectFrom("task_pull_request").selectAll().where("repository", "=", workflow.repository)
          .where("number", "=", number).executeTakeFirst();
        if (old && (old.task_id !== taskId || JSON.parse(old.snapshot).state === "merged")) {
          throw new CoordinationError("PULL_REQUEST_NOT_READY", "PR belongs to another Task or was already merged");
        }
        const latest = (await this.getTaskPullRequests(taskId, db)).at(-1);
        if (old && latest?.id !== old.id) throw new CoordinationError("PULL_REQUEST_NOT_READY", "Cannot reactivate a superseded PR");
        if (latest && latest.number !== number && latest.state === "open") {
          const previous = prefetched?.previous;
          if (!previous || previous.number !== latest.number) throw new CoordinationError("PULL_REQUEST_NOT_READY", "PR history changed; retry registration");
          if (previous.state === "open") throw new CoordinationError("PULL_REQUEST_NOT_READY", "Reuse or close the existing open PR before registering another");
          await db.updateTable("task_pull_request").set({ snapshot: JSON.stringify(previous), updated_at: this.clock() }).where("id", "=", latest.id).execute();
        }
        const now = this.clock();
        if (old) {
          await db.updateTable("task_pull_request").set({ work_claim_id: claimId, snapshot: JSON.stringify(pr),
            reviewed_head_sha: null, reviewed_comment_id: null, updated_at: now }).where("id", "=", old.id).execute();
        } else {
          await db.insertInto("task_pull_request").values({ task_id: taskId, repository: workflow.repository, number,
            work_claim_id: claimId, snapshot: JSON.stringify(pr), reviewed_head_sha: null, reviewed_comment_id: null, accepted_merge_sha: null,
            acceptance_evidence: null, created_at: now, updated_at: now }).execute();
        }
        await this.appendChange(db, { projectId: task.project_id, type: "TASK_PULL_REQUEST_REGISTERED", entityId: taskId,
          principalId, claimId, payload: { actorRole: "worker", pullRequest: pr }, occurredAt: now });
        return { pullRequest: pr };
      }));
  }

  private async verifyPullRequest(db: DatabaseExecutor, taskId: string, phase: "complete" | "review" | "accept",
    expectedSha?: string, claimId?: string, evidence?: string, prefetched?: PullRequestSnapshot, reviewCommentId?: number) {
    const task = await this.getTask(db, taskId);
    if (task.completion_mode === "evidence") {
      if (phase !== "complete") {
        const note = await db.selectFrom("task_comment").select("id").where("task_id", "=", taskId)
          .where("claim_id", "=", claimId ?? "").executeTakeFirst();
        if (!note || (phase === "accept" && !evidence?.trim())) throw new CoordinationError("INVALID_INPUT", "Evidence Tasks require a current Claim-bound verification note");
      }
      return null;
    }
    const workflow = await this.getRepositoryWorkflow(task.project_id, db);
    if (!workflow) return null;
    const row = await db.selectFrom("task_pull_request").selectAll().where("task_id", "=", taskId).orderBy("id", "desc").executeTakeFirst();
    if (!row) throw new CoordinationError("PULL_REQUEST_REQUIRED", "Register a PR before completing this Task");
    const pr = prefetched;
    if (!pr || pr.number !== row.number) throw new CoordinationError("PULL_REQUEST_NOT_READY", "PR history changed; retry verification");
    this.validateRepository(pr, workflow);
    if (phase === "complete") {
      if (row.work_claim_id !== claimId || pr.state !== "open" || pr.draft) {
        throw new CoordinationError("PULL_REQUEST_NOT_READY", "Register an open PR under the current Work Claim");
      }
    } else if (phase === "review") {
      if (pr.state !== "merged" || !pr.mergeSha || pr.headSha !== expectedSha || !checksPassed(pr, workflow.requiredChecks) ||
        !pr.reviewEvidence.some((evidence) => evidence.id === reviewCommentId && evidence.taskId === taskId &&
          evidence.claimId === claimId && evidence.headSha === expectedSha && evidence.decision === "approve")) {
        throw new CoordinationError("PULL_REQUEST_NOT_READY", "Reviewed head SHA, current Review Claim-bound comment, passing required CI and GitHub merge are required");
      }
    } else if (pr.state !== "merged" || !pr.mergeSha || row.reviewed_head_sha !== pr.headSha || pr.mergeSha !== expectedSha || !evidence?.trim()) {
      throw new CoordinationError("PULL_REQUEST_NOT_READY", "Verify AC against the reviewed merge SHA and provide acceptance evidence");
    }
    await db.updateTable("task_pull_request").set({ snapshot: JSON.stringify(pr), updated_at: this.clock(),
      ...(phase === "review" ? { reviewed_head_sha: pr.headSha, reviewed_comment_id: reviewCommentId! } : {}),
      ...(phase === "accept" ? { accepted_merge_sha: pr.mergeSha, acceptance_evidence: evidence!.trim() } : {})
    }).where("id", "=", row.id).execute();
    return pr;
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

  private async requireOneOfRoles(
    db: DatabaseExecutor,
    projectId: string,
    principalId: string,
    roles: Array<"worker" | "reviewer" | "manager">,
  ): Promise<"worker" | "reviewer" | "manager"> {
    const grants = await db
      .selectFrom("project_grant")
      .select("role")
      .where("project_id", "=", projectId)
      .where("principal_id", "=", principalId)
      .where("role", "in", roles)
      .execute();
    const role = roles.find((candidate) => grants.some((grant) => grant.role === candidate));
    if (!role) {
      throw new CoordinationError(
        "FORBIDDEN",
        `Principal ${principalId} does not have one of the required roles (${roles.join(", ")}) for project ${projectId}`,
      );
    }
    return role;
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
    return { projects: await Promise.all(projects.map(async (project) => ({ ...project, workflow: await this.getRepositoryWorkflow(project.id) }))) };
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
    actorRole: ActivityActorRole,
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
      payload: { actorRole, claimPrincipalId: claim.principal_id, expiresAt: claim.expires_at },
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
    const [tasks, stories, claims, grants, completionChanges] = await Promise.all([
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
      DatabaseClient.selectFrom("project_grant")
        .select("role")
        .where("project_id", "=", projectId)
        .where("principal_id", "=", principalId)
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
    const roles = new Set(grants.map((grant) => grant.role));
    const latestCompleters = new Map<string, string>();
    for (const change of completionChanges) {
      if (!latestCompleters.has(change.entity_id)) {
        latestCompleters.set(change.entity_id, change.principal_id);
      }
    }

    const ordered = [...tasks].sort((a, b) => {
      const aPrimary = a.story_id ? (storyOrders.get(a.story_id) ?? Number.MAX_SAFE_INTEGER) : a.sort_order;
      const bPrimary = b.story_id ? (storyOrders.get(b.story_id) ?? Number.MAX_SAFE_INTEGER) : b.sort_order;
      return aPrimary - bPrimary || a.sort_order - b.sort_order || a.created_at - b.created_at;
    });

    const workflow = await this.getRepositoryWorkflow(projectId);
    const isAvailable = (task: (typeof tasks)[number]) => {
      const claim = activeClaims.get(task.id);
      const hasUnexpiredClaim = claim !== undefined && claim.expires_at > now;
      switch (filter?.availableFor) {
        case "work":
          return (
            roles.has(ProjectRole.WORKER) &&
            (((task.status === TaskStatus.TODO || task.status === TaskStatus.REJECTED) &&
              !hasUnexpiredClaim) ||
              (task.status === TaskStatus.DOING && claim !== undefined && claim.expires_at <= now))
          );
        case "review":
          return (
            roles.has(ProjectRole.REVIEWER) &&
            task.status === TaskStatus.IN_REVIEW &&
            !hasUnexpiredClaim &&
            latestCompleters.get(task.id) !== principalId
          );
        case "acceptance":
          return (
            roles.has(ProjectRole.MANAGER) &&
            (task.status === TaskStatus.WAIT_ACCEPT || (!workflow && task.status === TaskStatus.IN_REVIEW)) &&
            !hasUnexpiredClaim &&
            latestCompleters.get(task.id) !== principalId
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
        completionMode: task.completion_mode,
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
          await this.expireClaim(db, currentClaim, task.project_id, principalId, "worker", now);
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
              payload: { actorRole: "worker", fromStatus: StoryStatus.TODO, toStatus: StoryStatus.DOING },
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
            actorRole: "worker",
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
          await this.expireClaim(db, currentClaim, task.project_id, principalId, "reviewer", now);
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
          payload: { actorRole: "reviewer", claimCommand: "claim_review", fromStatus: task.status, toStatus: task.status },
          occurredAt: now,
        });
        return this.claimResult(claim, TaskStatus.IN_REVIEW);
      }),
    );
  }

  private async claimAcceptanceCore(
    db: DatabaseExecutor,
    principalId: string,
    taskId: string,
    options: { requireManagerRole: boolean; enforceSelfAcceptance: boolean },
  ): Promise<ClaimResult> {
    const now = this.clock();
    const task = await this.getTask(db, taskId);
    if (options.requireManagerRole) {
      await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
    }
    const workflow = await this.getRepositoryWorkflow(task.project_id, db);
    if (workflow && task.status === TaskStatus.IN_REVIEW) {
      throw new CoordinationError("PULL_REQUEST_NOT_READY", "Reviewer must confirm the GitHub merge before acceptance");
    }
    const currentClaim = await this.getActiveClaim(db, taskId);
    if (currentClaim) {
      if (currentClaim.expires_at > now) {
        throw new CoordinationError("CLAIM_CONFLICT", `Task ${taskId} already has an active Claim`);
      }
      await this.expireClaim(
        db,
        currentClaim,
        task.project_id,
        principalId,
        options.requireManagerRole ? "manager" : "operator",
        now,
      );
    }
    if (task.status !== TaskStatus.IN_REVIEW && task.status !== TaskStatus.WAIT_ACCEPT) {
      throw new CoordinationError(
        "TASK_NOT_CLAIMABLE",
        `Task ${taskId} is not available for acceptance`,
      );
    }
    if (
      options.enforceSelfAcceptance &&
      (await this.latestCompleter(db, taskId)) === principalId
    ) {
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
        actorRole: options.requireManagerRole ? "manager" : "operator",
        claimCommand: "claim_acceptance",
        fromStatus,
        toStatus: TaskStatus.WAIT_ACCEPT,
        path: fromStatus === TaskStatus.IN_REVIEW ? "manager_direct_review" : "reviewer_approved",
      },
      occurredAt: now,
    });
    return this.claimResult(claim, TaskStatus.WAIT_ACCEPT);
  }

  async claimAcceptance(
    principalId: string,
    taskId: string,
    requestId: string,
  ): Promise<ClaimResult> {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "claim_acceptance", requestId, { taskId }, () =>
        this.claimAcceptanceCore(db, principalId, taskId, {
          requireManagerRole: true,
          enforceSelfAcceptance: true,
        }),
      ),
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
          throw new CoordinationError("INVALID_INPUT", "Release reason is required");
        }
        const now = this.clock();
        const actorRole: ActivityActorRole =
          task.status === TaskStatus.DOING
            ? "worker"
            : task.status === TaskStatus.IN_REVIEW
              ? "reviewer"
              : "manager";
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
          payload: { actorRole, reason: trimmedReason, taskStatus },
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
          const task = await this.getTask(db, taskId);
          if (task.status === TaskStatus.DOING) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.WORKER);
          } else if (task.status === TaskStatus.IN_REVIEW) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
          } else if (task.status === TaskStatus.WAIT_ACCEPT) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
          } else {
            throw new CoordinationError(
              "INVALID_TASK_STATUS",
              `Task ${taskId} does not accept Claim-bound comments in ${task.status}`,
            );
          }
          const trimmedBody = body.trim();
          if (!trimmedBody) {
            throw new CoordinationError("INVALID_INPUT", "Comment body is required");
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
    const prefetched = await this.prefetchPullRequest(principalId, taskId, claimId, "complete_task", requestId, "worker");
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
        const pr = await this.verifyPullRequest(db, taskId, "complete", undefined, claimId, undefined, prefetched?.current);
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
          payload: { actorRole: "worker", fromStatus: TaskStatus.DOING, toStatus: TaskStatus.IN_REVIEW, pullRequest: pr },
          occurredAt: now,
        });
        return { taskId, claimId, status: TaskStatus.IN_REVIEW };
      }),
    );
  }

  async reviewedTask(principalId: string, taskId: string, claimId: string, requestId: string, expectedHeadSha?: string, reviewCommentId?: number) {
    const prefetched = await this.prefetchPullRequest(principalId, taskId, claimId, "reviewed_task", requestId, "reviewer");
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "reviewed_task", requestId, { taskId, claimId, expectedHeadSha, reviewCommentId }, async () => {
        await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
        if (task.status !== TaskStatus.IN_REVIEW) {
          throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not in_review`);
        }
        const pr = await this.verifyPullRequest(db, taskId, "review", expectedHeadSha, claimId, undefined, prefetched?.current, reviewCommentId);
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
          payload: { actorRole: "reviewer", fromStatus: TaskStatus.IN_REVIEW, toStatus: TaskStatus.WAIT_ACCEPT, pullRequest: pr, reviewCommentId },
          occurredAt: now,
        });
        return { taskId, claimId, status: TaskStatus.WAIT_ACCEPT };
      }),
    );
  }

  private async syncStoryAfterAcceptance(
    db: DatabaseExecutor,
    projectId: string,
    storyId: string | null,
    principalId: string,
    claimId: string,
    actorRole: ActivityActorRole,
    now: number,
  ) {
    if (!storyId) return;
    const unsettled = await db
      .selectFrom("task")
      .select("id")
      .where("story_id", "=", storyId)
      .where("status", "not in", [TaskStatus.ACCEPTED, TaskStatus.CANCELED])
      .executeTakeFirst();
    if (!unsettled) {
      const result = await db
        .updateTable("story")
        .set({ status: "done", updated_at: now })
        .where("id", "=", storyId)
        .where("status", "=", "doing")
        .executeTakeFirst();
      if (result.numUpdatedRows > 0n) {
        await this.appendChange(db, {
          projectId,
          type: "STORY_COMPLETED",
          entityId: storyId,
          principalId,
          claimId,
          payload: { actorRole, fromStatus: StoryStatus.DOING, toStatus: StoryStatus.DONE, path: "task_acceptance" },
          occurredAt: now,
        });
      }
    }
  }

  private async acceptTaskCore(
    db: DatabaseExecutor,
    principalId: string,
    taskId: string,
    claimId: string,
    actorRole: ActivityActorRole,
    verification?: AcceptanceVerification,
    prefetched?: PullRequestSnapshot,
  ) {
    const task = await this.getTask(db, taskId);
    if (task.status !== TaskStatus.WAIT_ACCEPT) {
      throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not wait_accept`);
    }
    const pr = await this.verifyPullRequest(db, taskId, "accept", verification?.mergeSha, claimId, verification?.evidence, prefetched);
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
      payload: { actorRole, fromStatus: TaskStatus.WAIT_ACCEPT, toStatus: TaskStatus.ACCEPTED, pullRequest: pr, verification },
      occurredAt: now,
    });
    await this.syncStoryAfterAcceptance(
      db,
      task.project_id,
      task.story_id,
      principalId,
      claimId,
      actorRole,
      now,
    );
    return { taskId, claimId, status: TaskStatus.ACCEPTED };
  }

  async acceptTask(principalId: string, taskId: string, claimId: string, requestId: string, verification?: AcceptanceVerification) {
    const prefetched = await this.prefetchPullRequest(principalId, taskId, claimId, "accept_task", requestId, "manager");
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "accept_task", requestId, { taskId, claimId, verification }, async () => {
        await this.assertCurrentClaim(db, principalId, taskId, claimId);
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
        return this.acceptTaskCore(db, principalId, taskId, claimId, "manager", verification, prefetched?.current);
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
          let actorRole: ActivityActorRole;
          if (task.status === TaskStatus.IN_REVIEW) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.REVIEWER);
            actorRole = "reviewer";
          } else if (task.status === TaskStatus.WAIT_ACCEPT) {
            await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
            actorRole = "manager";
          } else {
            throw new CoordinationError(
              "INVALID_TASK_STATUS",
              `Task ${taskId} is not reviewable`,
            );
          }
          return this.rejectTaskCore(db, principalId, taskId, claimId, reason, actorRole);
        },
      ),
    );
  }

  private async rejectTaskCore(
    db: DatabaseExecutor,
    principalId: string,
    taskId: string,
    claimId: string,
    reason: string,
    actorRole: ActivityActorRole,
  ) {
    const task = await this.getTask(db, taskId);
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new CoordinationError("INVALID_INPUT", "Reject reason is required");
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
      payload: { actorRole, fromStatus, toStatus: TaskStatus.REJECTED, reason: trimmedReason },
      occurredAt: now,
    });
    return { taskId, claimId, status: TaskStatus.REJECTED, rejectReason: trimmedReason };
  }

  // trusted-local Web UI専用。外部入力から任意のprincipalIdを渡すAPIとして公開しない。
  async acceptTaskAsOperator(principalId: string, taskId: string, verification?: AcceptanceVerification) {
    const prefetched = await this.prefetchPullRequest(principalId, taskId, null, "accept_task", "", "operator");
    return DatabaseClient.transaction().execute(async (db) => {
      const claim = await this.claimAcceptanceCore(db, principalId, taskId, {
        requireManagerRole: false,
        enforceSelfAcceptance: false,
      });
      return this.acceptTaskCore(db, principalId, taskId, claim.claimId, "operator", verification, prefetched?.current);
    });
  }

  async rejectTaskAsOperator(principalId: string, taskId: string, reason: string) {
    return DatabaseClient.transaction().execute(async (db) => {
      const claim = await this.claimAcceptanceCore(db, principalId, taskId, {
        requireManagerRole: false,
        enforceSelfAcceptance: false,
      });
      return this.rejectTaskCore(db, principalId, taskId, claim.claimId, reason, "operator");
    });
  }

  private async cancelTaskCore(
    db: DatabaseExecutor,
    principalId: string,
    taskId: string,
    reason: string,
    actorRole: ActivityActorRole,
  ) {
    const task = await this.getTask(db, taskId);
    if (task.status !== TaskStatus.TODO && task.status !== TaskStatus.DOING) {
      throw new CoordinationError("INVALID_TASK_STATUS", `Task ${taskId} is not cancelable`);
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new CoordinationError("INVALID_INPUT", "Cancel reason is required");
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
      payload: { actorRole, fromStatus: task.status, toStatus: TaskStatus.CANCELED, reason: trimmedReason },
      occurredAt: now,
    });
    return { taskId, status: TaskStatus.CANCELED, reason: trimmedReason };
  }

  async cancelTask(principalId: string, taskId: string, reason: string, requestId: string) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "cancel_task", requestId, { taskId, reason }, async () => {
        const task = await this.getTask(db, taskId);
        await this.requireRole(db, task.project_id, principalId, ProjectRole.MANAGER);
        return this.cancelTaskCore(db, principalId, taskId, reason, "manager");
      }),
    );
  }

  async cancelTaskAsOperator(principalId: string, taskId: string, reason: string) {
    return DatabaseClient.transaction().execute((db) =>
      this.cancelTaskCore(db, principalId, taskId, reason, "operator"),
    );
  }

  async issueTask(
    principalId: string,
    input: { projectId: string; storyId?: string; title: string; description?: string; completionMode?: "pull_request" | "evidence" },
    requestId: string,
  ) {
    return DatabaseClient.transaction().execute(async (db) =>
      this.withReceipt(db, principalId, "issue_task", requestId, input, async () => {
        const actorRole = await this.requireOneOfRoles(db, input.projectId, principalId, [
          ProjectRole.MANAGER,
          ProjectRole.REVIEWER,
          ProjectRole.WORKER,
        ]);
        const completionMode = input.completionMode ?? "pull_request";
        if (!["pull_request", "evidence"].includes(completionMode)) throw new CoordinationError("INVALID_INPUT", "Unknown completion mode");
        if (completionMode === "evidence") await this.requireRole(db, input.projectId, principalId, ProjectRole.MANAGER);
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
            completion_mode: completionMode,
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
          payload: { actorRole, status: TaskStatus.TODO, storyId: input.storyId ?? null, completionMode },
          occurredAt: now,
        });
        return {
          id,
          projectId: input.projectId,
          storyId: input.storyId ?? null,
          title,
          description: input.description?.trim() || null,
          status: TaskStatus.TODO,
          completionMode,
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
      completionMode?: "pull_request" | "evidence";
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
        if (input.completionMode !== undefined && !["pull_request", "evidence"].includes(input.completionMode)) {
          throw new CoordinationError("INVALID_INPUT", "Unknown completion mode");
        }
        if (input.completionMode !== undefined && input.completionMode !== task.completion_mode) {
          const active = await db.selectFrom("task_claim").select("id").where("task_id", "=", task.id)
            .where("state", "=", "active").where("expires_at", ">", this.clock()).executeTakeFirst();
          const prs = await this.getTaskPullRequests(task.id, db);
          if (![TaskStatus.TODO, TaskStatus.REJECTED].includes(task.status as "todo" | "rejected") || active || prs.length) {
            throw new CoordinationError("INVALID_TASK_STATUS", "Completion mode requires an unclaimed todo/rejected Task without PR history");
          }
        }
        const title = this.requiredText(input.title, "Task title");
        const now = this.clock();
        await db
          .updateTable("task")
          .set({
            title,
            description: input.description?.trim() || null,
            ...(input.sortOrder === undefined ? {} : { sort_order: input.sortOrder }),
            ...(input.completionMode === undefined ? {} : { completion_mode: input.completionMode }),
            updated_at: now,
          })
          .where("id", "=", input.taskId)
          .execute();
        if (input.completionMode !== undefined && input.completionMode !== task.completion_mode) {
          await this.appendChange(db, { projectId: input.projectId, type: "TASK_UPDATED", entityId: task.id,
            principalId, payload: { actorRole: "manager", completionMode: input.completionMode }, occurredAt: now });
        }
        const updated = await this.getTask(db, input.taskId);
        return {
          id: updated.id,
          projectId: updated.project_id,
          storyId: updated.story_id,
          title: updated.title,
          description: updated.description,
          completionMode: updated.completion_mode,
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
          payload: { actorRole: "manager", status: StoryStatus.TODO },
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
          payload: { actorRole: "manager", fromStatus: StoryStatus.DOING, toStatus: StoryStatus.DONE },
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
          payload: { actorRole: "manager", fromStatus: StoryStatus.DOING, toStatus: StoryStatus.CANCELED, reason: trimmedReason },
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
