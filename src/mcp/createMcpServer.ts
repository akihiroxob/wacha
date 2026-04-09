import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolContext } from "../domain/model/ToolContext.js";
import { ListProjectTool } from "@mcp/tool/ListProjectTool.ts";
import { ListProjectAgentsTool } from "@mcp/tool/ListProjectAgentsTool.ts";
import { ListStoryTool } from "@mcp/tool/ListStoryTool.ts";
import { IssueStoryTool } from "@mcp/tool/IssueStoryTool.ts";
import { ClaimStoryTool } from "@mcp/tool/ClaimStoryTool.ts";
import { CompleteStoryTool } from "@mcp/tool/CompleteStoryTool.ts";
import { CancelStoryTool } from "@mcp/tool/CancelStoryTool.ts";
import { ListTaskTool } from "@mcp/tool/ListTaskTool.ts";
import { IssueTaskTool } from "@mcp/tool/IssueTaskTool.ts";
import { AcceptTaskTool } from "@mcp/tool/AcceptTaskTool.ts";
import { RejectTaskTool } from "@mcp/tool/RejectTaskTool.ts";
import { ClaimTaskTool } from "@mcp/tool/ClaimTaskTool.ts";
import { CompleteTaskTool } from "@mcp/tool/CompleteTaskTool.ts";
import { AssignTool } from "@mcp/tool/AssignTool.ts";
import { withRoleGuard } from "@mcp/middleware/RoleGuard.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";

const name = "wacha";
const version = "1.0.0";
const instructions =
  "Project, story, and task management server for listing, issuing, claiming, completing, accepting, and rejecting work.";
export const createMcpServer = (context: ToolContext) => {
  const server = new McpServer({ name, version }, { instructions });
  // tool for project
  server.registerTool("list_projects", ListProjectTool.config, ListProjectTool.execute);
  server.registerTool(
    "list_project_agents",
    ListProjectAgentsTool.config,
    ListProjectAgentsTool.execute,
  );

  // tool for story
  server.registerTool("list_stories", ListStoryTool.config, ListStoryTool.execute);
  server.registerTool(
    "issue_story",
    IssueStoryTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, IssueStoryTool.execute),
  );
  server.registerTool(
    "claim_story",
    ClaimStoryTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, ClaimStoryTool.execute),
  );
  server.registerTool(
    "complete_story",
    CompleteStoryTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, CompleteStoryTool.execute),
  );
  server.registerTool(
    "cancel_story",
    CancelStoryTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, CancelStoryTool.execute),
  );

  // tool for task
  server.registerTool("list_tasks", ListTaskTool.config, ListTaskTool.execute);
  server.registerTool(
    "issue_task",
    IssueTaskTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, IssueTaskTool.execute),
  );
  server.registerTool("claim_task", ClaimTaskTool.config, ClaimTaskTool.execute);
  server.registerTool("complete_task", CompleteTaskTool.config, CompleteTaskTool.execute);
  server.registerTool(
    "accept_task",
    AcceptTaskTool.config,
    withRoleGuard([ProjectRole.MANAGER], context, AcceptTaskTool.execute),
  );
  server.registerTool("reject_task", RejectTaskTool.config, RejectTaskTool.execute);
  server.registerTool("assign_project_role", AssignTool.config, AssignTool.execute);

  return server;
};
