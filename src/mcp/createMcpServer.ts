import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListTaskTool } from "@tool/ListTaskTool.ts";
import { IssueTaskTool } from "@tool/IssueTaskTool.ts";
import { AcceptTaskTool } from "@tool/AcceptTaskTool.ts";
import { RejectTaskTool } from "@tool/RejectTaskTool.ts";
import { ClaimTaskTool } from "@tool/ClaimTaskTool.ts";
import { CompleteTaskTool } from "@tool/CompleteTaskTool.ts";

const name = "wacha";
const version = "1.0.0";
const instructions =
  "Task management server for listing, issuing, claiming, completing, accepting, and rejecting tasks.";
export const createMcpServer = () => {
  const server = new McpServer({ name, version }, { instructions });
  server.registerTool("list_tasks", ListTaskTool.config, ListTaskTool.execute);
  server.registerTool("issue_task", IssueTaskTool.config, IssueTaskTool.execute);
  server.registerTool("claim_task", ClaimTaskTool.config, ClaimTaskTool.execute);
  server.registerTool("complete_task", CompleteTaskTool.config, CompleteTaskTool.execute);
  server.registerTool("accept_task", AcceptTaskTool.config, AcceptTaskTool.execute);
  server.registerTool("reject_task", RejectTaskTool.config, RejectTaskTool.execute);

  return server;
};
