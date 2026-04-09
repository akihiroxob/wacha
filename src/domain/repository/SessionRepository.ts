import { McpSession } from "@domain/model/McpSession.ts";

export interface SessionRepository {
  registerSession(sessionId: string, entry: McpSession): void;
  getSessionBySessionId(sessionId: string): McpSession | undefined;
  removeSessionBySessionId(sessionId: string): void;
}
