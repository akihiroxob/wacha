import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export type McpSessionEntry = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  workerId?: string;
};

const sessions = new Map<string, McpSessionEntry>();
const sessionIdsByWorkerId = new Map<string, Set<string>>();

const removeWorkerIndex = (sessionId: string, workerId?: string) => {
  if (!workerId) return;

  const sessionIds = sessionIdsByWorkerId.get(workerId);
  if (!sessionIds) return;

  sessionIds.delete(sessionId);
  if (sessionIds.size === 0) {
    sessionIdsByWorkerId.delete(workerId);
  }
};

const addWorkerIndex = (sessionId: string, workerId: string) => {
  const sessionIds = sessionIdsByWorkerId.get(workerId) ?? new Set<string>();
  sessionIds.add(sessionId);
  sessionIdsByWorkerId.set(workerId, sessionIds);
};

export const registerSession = (sessionId: string, entry: McpSessionEntry) => {
  sessions.set(sessionId, entry);
  if (entry.workerId) {
    addWorkerIndex(sessionId, entry.workerId);
  }
};

export const getSession = (sessionId: string): McpSessionEntry | undefined => sessions.get(sessionId);

export const setSessionWorkerId = (sessionId: string, workerId?: string) => {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  if (entry.workerId === workerId) return;

  removeWorkerIndex(sessionId, entry.workerId);
  entry.workerId = workerId;
  if (workerId) {
    addWorkerIndex(sessionId, workerId);
  }
};

export const removeSession = (sessionId: string) => {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  removeWorkerIndex(sessionId, entry.workerId);
  sessions.delete(sessionId);
};

export const getSessionsByWorkerId = (workerId: string): McpSessionEntry[] => {
  const sessionIds = sessionIdsByWorkerId.get(workerId);
  if (!sessionIds) return [];

  return [...sessionIds]
    .map((sessionId) => sessions.get(sessionId))
    .filter((entry): entry is McpSessionEntry => entry !== undefined);
};
