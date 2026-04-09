import { McpSession } from "@domain/model/McpSession.ts";
import { SessionRepository } from "@domain/repository/SessionRepository.ts";

export class SessionService {
  constructor(private sessionRepository: SessionRepository) {}

  registerSession(sessionId: string, entry: McpSession) {
    this.sessionRepository.registerSession(sessionId, entry);
  }

  getSessionBySessionId(sessionId: string): McpSession | undefined {
    return this.sessionRepository.getSessionBySessionId(sessionId);
  }
  removeSessionBySessionId(sessionId: string): void {
    this.sessionRepository.removeSessionBySessionId(sessionId);
  }
}
