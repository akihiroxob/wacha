import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CoordinationError } from "@application/error/CoordinationError.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import {
  getSkillContextUseCase,
  instructionService,
  listSkillUseCase,
  taskCoordinationService,
} from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

const name = "wacha";
const version = "2.0.0";
const instructions =
  "Stateless task coordination server. Agents choose Tasks; Wacha validates Project grants, exclusive Claims, and guarded state transitions.";

const requestIdSchema = z
  .string()
  .min(1)
  .describe("Caller-generated idempotency key");
const claimIdSchema = z.string().uuid().describe("Current Task Claim ID");

const execute = async (operation: () => Promise<unknown>, message?: string) => {
  try {
    return toTextResult(await operation(), message);
  } catch (error) {
    if (error instanceof CoordinationError) {
      const structured = { error: error.toJSON() };
      return {
        ...toTextResult(structured, `${error.code}: ${error.message}`),
        isError: true,
      };
    }
    throw error;
  }
};

export const createMcpServer = (principalId: string) => {
  const server = new McpServer({ name, version }, { instructions });

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "List Projects granted to this Principal.",
      inputSchema: {},
    },
    () => execute(() => taskCoordinationService.listProjects(principalId)),
  );
  server.registerTool(
    "list_stories",
    {
      title: "List Stories",
      description: "List Stories for a granted Project.",
      inputSchema: {
        projectId: z.string().min(1),
        status: z
          .enum([
            StoryStatus.TODO,
            StoryStatus.DOING,
            StoryStatus.DONE,
            StoryStatus.CANCELED,
          ])
          .optional(),
      },
    },
    ({ projectId, status }) =>
      execute(() =>
        taskCoordinationService.listStories(principalId, projectId, status),
      ),
  );
  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description:
        "List Task facts or availability. status and availableFor are mutually exclusive; the Agent chooses which Task to claim.",
      inputSchema: {
        projectId: z.string().min(1),
        filter: z
          .object({
            status: z
              .array(
                z.enum([
                  TaskStatus.TODO,
                  TaskStatus.DOING,
                  TaskStatus.CANCELED,
                  TaskStatus.IN_REVIEW,
                  TaskStatus.WAIT_ACCEPT,
                  TaskStatus.ACCEPTED,
                  TaskStatus.REJECTED,
                ]),
              )
              .optional(),
            availableFor: z.enum(["work", "review", "acceptance"]).optional(),
            storyId: z.string().min(1).optional(),
          })
          .optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    ({ projectId, filter, limit }) =>
      execute(() =>
        taskCoordinationService.listTasks(
          principalId,
          projectId,
          filter,
          limit,
        ),
      ),
  );
  server.registerTool(
    "list_task_comments",
    {
      title: "List Task Comments",
      description: "List Claim-bound handoff comments for a Task.",
      inputSchema: { taskId: z.string().min(1) },
    },
    ({ taskId }) =>
      execute(() =>
        taskCoordinationService.listTaskComments(principalId, taskId),
      ),
  );
  server.registerTool(
    "list_changes",
    {
      title: "List Changes",
      description: "Read append-only Project changes after a durable cursor.",
      inputSchema: {
        projectId: z.string().min(1),
        afterCursor: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    ({ projectId, afterCursor, limit }) =>
      execute(() =>
        taskCoordinationService.listChanges(
          principalId,
          projectId,
          afterCursor,
          limit,
        ),
      ),
  );

  server.registerTool(
    "issue_story",
    {
      title: "Issue Story",
      description: "Create a Story as a Manager.",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        requestId: requestIdSchema,
      },
    },
    ({ requestId, ...input }) =>
      execute(() =>
        taskCoordinationService.issueStory(principalId, input, requestId),
      ),
  );
  server.registerTool(
    "edit_story",
    {
      title: "Edit Story",
      description: "Update a Story as a Manager.",
      inputSchema: {
        projectId: z.string().min(1),
        storyId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        sortOrder: z.number().int().min(0).optional(),
        requestId: requestIdSchema,
      },
    },
    ({ requestId, ...input }) =>
      execute(() =>
        taskCoordinationService.editStory(principalId, input, requestId),
      ),
  );
  server.registerTool(
    "complete_story",
    {
      title: "Complete Story",
      description: "Complete a settled Story as a Manager.",
      inputSchema: { storyId: z.string().min(1), requestId: requestIdSchema },
    },
    ({ storyId, requestId }) =>
      execute(() =>
        taskCoordinationService.completeStory(principalId, storyId, requestId),
      ),
  );
  server.registerTool(
    "cancel_story",
    {
      title: "Cancel Story",
      description: "Cancel a Story with a durable reason.",
      inputSchema: {
        storyId: z.string().min(1),
        reason: z.string().min(1),
        requestId: requestIdSchema,
      },
    },
    ({ storyId, reason, requestId }) =>
      execute(() =>
        taskCoordinationService.cancelStory(
          principalId,
          storyId,
          reason,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "issue_task",
    {
      title: "Issue Task",
      description: "Create a Task as a Manager.",
      inputSchema: {
        projectId: z.string().min(1),
        storyId: z.string().min(1).optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        requestId: requestIdSchema,
      },
    },
    ({ requestId, ...input }) =>
      execute(() =>
        taskCoordinationService.issueTask(principalId, input, requestId),
      ),
  );
  server.registerTool(
    "edit_task",
    {
      title: "Edit Task",
      description: "Update a Task as a Manager.",
      inputSchema: {
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        sortOrder: z.number().int().min(0).optional(),
        requestId: requestIdSchema,
      },
    },
    ({ requestId, ...input }) =>
      execute(() =>
        taskCoordinationService.editTask(principalId, input, requestId),
      ),
  );
  server.registerTool(
    "cancel_task",
    {
      title: "Cancel Task",
      description: "Cancel a todo or doing Task and fence any current Claim.",
      inputSchema: {
        taskId: z.string().min(1),
        reason: z.string().min(1),
        requestId: requestIdSchema,
      },
    },
    ({ taskId, reason, requestId }) =>
      execute(() =>
        taskCoordinationService.cancelTask(
          principalId,
          taskId,
          reason,
          requestId,
        ),
      ),
  );

  server.registerTool(
    "claim_task",
    {
      title: "Claim Task",
      description: "Atomically acquire a work Claim for a selected Task.",
      inputSchema: { taskId: z.string().min(1), requestId: requestIdSchema },
    },
    ({ taskId, requestId }) =>
      execute(() =>
        taskCoordinationService.claimTask(principalId, taskId, requestId),
      ),
  );
  server.registerTool(
    "claim_review",
    {
      title: "Claim Review",
      description:
        "Atomically acquire a review Claim for a selected in_review Task.",
      inputSchema: { taskId: z.string().min(1), requestId: requestIdSchema },
    },
    ({ taskId, requestId }) =>
      execute(() =>
        taskCoordinationService.claimReview(principalId, taskId, requestId),
      ),
  );
  server.registerTool(
    "claim_acceptance",
    {
      title: "Claim Acceptance",
      description:
        "Acquire an acceptance Claim. An in_review Task is atomically moved to wait_accept as a Manager direct review.",
      inputSchema: { taskId: z.string().min(1), requestId: requestIdSchema },
    },
    ({ taskId, requestId }) =>
      execute(() =>
        taskCoordinationService.claimAcceptance(principalId, taskId, requestId),
      ),
  );
  server.registerTool(
    "renew_claim",
    {
      title: "Renew Claim",
      description:
        "Extend the current Task Claim lease. This is not an agent heartbeat.",
      inputSchema: { claimId: claimIdSchema },
    },
    ({ claimId }) =>
      execute(() => taskCoordinationService.renewClaim(principalId, claimId)),
  );
  server.registerTool(
    "release_claim",
    {
      title: "Release Claim",
      description: "Release the current Task Claim with a reason.",
      inputSchema: {
        claimId: claimIdSchema,
        reason: z.string().min(1),
        requestId: requestIdSchema,
      },
    },
    ({ claimId, reason, requestId }) =>
      execute(() =>
        taskCoordinationService.releaseClaim(
          principalId,
          claimId,
          reason,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "add_task_comment",
    {
      title: "Add Task Comment",
      description:
        "Add a handoff or verification comment under the current Claim.",
      inputSchema: {
        taskId: z.string().min(1),
        claimId: claimIdSchema,
        body: z.string().min(1),
        requestId: requestIdSchema,
      },
    },
    ({ taskId, claimId, body, requestId }) =>
      execute(() =>
        taskCoordinationService.addTaskComment(
          principalId,
          taskId,
          claimId,
          body,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "complete_task",
    {
      title: "Complete Task",
      description:
        "Complete work under the current Claim and move the Task to in_review.",
      inputSchema: {
        taskId: z.string().min(1),
        claimId: claimIdSchema,
        requestId: requestIdSchema,
      },
    },
    ({ taskId, claimId, requestId }) =>
      execute(() =>
        taskCoordinationService.completeTask(
          principalId,
          taskId,
          claimId,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "reviewed_task",
    {
      title: "Reviewed Task",
      description: "Approve implementation under the current Review Claim.",
      inputSchema: {
        taskId: z.string().min(1),
        claimId: claimIdSchema,
        requestId: requestIdSchema,
      },
    },
    ({ taskId, claimId, requestId }) =>
      execute(() =>
        taskCoordinationService.reviewedTask(
          principalId,
          taskId,
          claimId,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "accept_task",
    {
      title: "Accept Task",
      description:
        "Accept a wait_accept Task under the current Acceptance Claim.",
      inputSchema: {
        taskId: z.string().min(1),
        claimId: claimIdSchema,
        requestId: requestIdSchema,
      },
    },
    ({ taskId, claimId, requestId }) =>
      execute(() =>
        taskCoordinationService.acceptTask(
          principalId,
          taskId,
          claimId,
          requestId,
        ),
      ),
  );
  server.registerTool(
    "reject_task",
    {
      title: "Reject Task",
      description:
        "Reject a Task under the current Review or Acceptance Claim.",
      inputSchema: {
        taskId: z.string().min(1),
        claimId: claimIdSchema,
        reason: z.string().min(1),
        requestId: requestIdSchema,
      },
    },
    ({ taskId, claimId, reason, requestId }) =>
      execute(() =>
        taskCoordinationService.rejectTask(
          principalId,
          taskId,
          claimId,
          reason,
          requestId,
        ),
      ),
  );

  server.registerTool(
    "list_skills",
    {
      title: "List Skills",
      description: "List available Skills.",
      inputSchema: {
        status: z.enum(["draft", "active", "deprecated"]).optional(),
        role: z.enum(["manager", "reviewer", "worker", "viewer"]).optional(),
      },
    },
    ({ status, role }) =>
      execute(() => listSkillUseCase.execute({ status, role })),
  );
  server.registerTool(
    "get_skill_context",
    {
      title: "Get Skill Context",
      description: "Get a Skill and its required knowledge.",
      inputSchema: { name: z.string().min(1) },
    },
    ({ name }) => execute(() => getSkillContextUseCase.execute({ name })),
  );
  server.registerTool(
    "get_role_instructions",
    {
      title: "Get Role Instructions",
      description: "Get operational instructions for a Project Role.",
      inputSchema: {
        role: z.enum(["manager", "reviewer", "worker"]),
        includeShared: z.boolean().optional(),
      },
    },
    ({ role, includeShared }) =>
      execute(async () => {
        const roleContent =
          await instructionService.getInstructionContent(role);
        const policyContent = includeShared
          ? await instructionService.getInstructionContent("role-policy")
          : null;
        return {
          role,
          includeShared: includeShared ?? false,
          files: [
            ...(policyContent
              ? [
                  {
                    path: "agent/role-policy.md",
                    kind: "shared",
                    content: policyContent,
                  },
                ]
              : []),
            { path: `agent/${role}.md`, kind: "role", content: roleContent },
          ],
        };
      }),
  );

  return server;
};
