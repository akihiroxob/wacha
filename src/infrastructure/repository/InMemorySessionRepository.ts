import type { McpSession } from "@domain/model/McpSession.d.ts";
import { sessionsBySessionId, sessionIdByWorkerId } from "@database/SessionDatabase.ts";
import { SessionRepository } from "@domain/repository/SessionRepository.ts";

export class InMemorySessionRepository implements SessionRepository {
  /**
   * Session を登録
   */
  registerSession(sessionId: string, entry: McpSession) {
    const existingSessionId = sessionIdByWorkerId.get(entry.workerId);
    if (existingSessionId && existingSessionId !== sessionId) {
      sessionsBySessionId.delete(existingSessionId);
    }

    sessionsBySessionId.set(sessionId, entry);
    sessionIdByWorkerId.set(entry.workerId, sessionId);
  }

  /**
   * SessionId から取得
   */
  getSessionBySessionId(sessionId: string): McpSession | undefined {
    return sessionsBySessionId.get(sessionId);
  }

  /**
   * WorkerId から取得
   */
  getSessionByWorkerId(workerId: string): McpSession | undefined {
    const sessionId = sessionIdByWorkerId.get(workerId);
    if (!sessionId) return undefined;

    return sessionsBySessionId.get(sessionId);
  }

  /**
   * WorkerId -> SessionId のみ取得したい場合
   */
  getSessionIdByWorkerId(workerId: string): string | undefined {
    return sessionIdByWorkerId.get(workerId);
  }

  /**
   * WorkerId から削除
   */
  removeSessionByWorkerId(workerId: string) {
    const sessionId = sessionIdByWorkerId.get(workerId);
    if (!sessionId) return;

    sessionIdByWorkerId.delete(workerId);
    sessionsBySessionId.delete(sessionId);
  }

  removeSessionBySessionId(sessionId: string) {
    const session = sessionsBySessionId.get(sessionId);
    if (!session) return;

    sessionsBySessionId.delete(sessionId);
    sessionIdByWorkerId.delete(session.workerId);
  }
}
