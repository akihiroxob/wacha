import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListProjectTool } from "@tool/ListProjectTool.ts";
import { ListStoryTool } from "@tool/ListStoryTool.ts";
import { IssueStoryTool } from "@tool/IssueStoryTool.ts";
import { ClaimStoryTool } from "@tool/ClaimStoryTool.ts";
import { CompleteStoryTool } from "@tool/CompleteStoryTool.ts";
import { CancelStoryTool } from "@tool/CancelStoryTool.ts";
import { ListTaskTool } from "@tool/ListTaskTool.ts";
import { IssueTaskTool } from "@tool/IssueTaskTool.ts";
import { AcceptTaskTool } from "@tool/AcceptTaskTool.ts";
import { RejectTaskTool } from "@tool/RejectTaskTool.ts";
import { ClaimTaskTool } from "@tool/ClaimTaskTool.ts";
import { CompleteTaskTool } from "@tool/CompleteTaskTool.ts";
import { AssignTool } from "@tool/AssignTool.ts";

const name = "wacha";
const version = "1.0.0";
const instructions =
  "Project, story, and task management server for listing, issuing, claiming, completing, accepting, and rejecting work.";
export const createMcpServer = () => {
  const server = new McpServer({ name, version }, { instructions });
  server.registerTool("list_projects", ListProjectTool.config, ListProjectTool.execute);
  server.registerTool("list_stories", ListStoryTool.config, ListStoryTool.execute);
  server.registerTool("issue_story", IssueStoryTool.config, IssueStoryTool.execute);
  server.registerTool("claim_story", ClaimStoryTool.config, ClaimStoryTool.execute);
  server.registerTool("complete_story", CompleteStoryTool.config, CompleteStoryTool.execute);
  server.registerTool("cancel_story", CancelStoryTool.config, CancelStoryTool.execute);
  server.registerTool("list_tasks", ListTaskTool.config, ListTaskTool.execute);
  server.registerTool("issue_task", IssueTaskTool.config, IssueTaskTool.execute);
  server.registerTool("claim_task", ClaimTaskTool.config, ClaimTaskTool.execute);
  server.registerTool("complete_task", CompleteTaskTool.config, CompleteTaskTool.execute);
  server.registerTool("accept_task", AcceptTaskTool.config, AcceptTaskTool.execute);
  server.registerTool("reject_task", RejectTaskTool.config, RejectTaskTool.execute);
  server.registerTool("assign_project_role", AssignTool.config, AssignTool.execute);

  return server;
};
