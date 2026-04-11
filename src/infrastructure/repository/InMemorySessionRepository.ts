import type { McpSession } from "@domain/model/McpSession.d.ts";
import { sessionsBySessionId } from "@database/SessionDatabase.ts";
import { SessionRepository } from "@domain/repository/SessionRepository.ts";

export class InMemorySessionRepository implements SessionRepository {
  /**
   * Session を登録
   */
  registerSession(sessionId: string, entry: McpSession) {
    sessionsBySessionId.set(sessionId, entry);
  }

  /**
   * SessionId から取得
   */
  getSessionBySessionId(sessionId: string): McpSession | undefined {
    return sessionsBySessionId.get(sessionId);
  }

  removeSessionBySessionId(sessionId: string) {
    sessionsBySessionId.delete(sessionId);
  }
}
