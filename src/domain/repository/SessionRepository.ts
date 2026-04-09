import { McpSession } from "@domain/model/McpSession.ts";

export interface SessionRepository {
  registerSession(sessionId: string, entry: McpSession): void;
  getSessionBySessionId(sessionId: string): McpSession | undefined;
  getSessionByWorkerId(workerId: string): McpSession | undefined;
  getSessionIdByWorkerId(workerId: string): string | undefined;
  removeSessionByWorkerId(workerId: string): void;
  removeSessionBySessionId(sessionId: string): void;
}
