import type { McpSession } from "./types/McpSession.js";

const sessionsBySessionId = new Map<string, McpSession>();
const sessionIdByWorkerId = new Map<string, string>();

/**
 * Session を登録
 */
export const registerSession = (sessionId: string, entry: McpSession) => {
  const existingSessionId = sessionIdByWorkerId.get(entry.workerId);
  if (existingSessionId && existingSessionId !== sessionId) {
    sessionsBySessionId.delete(existingSessionId);
  }

  sessionsBySessionId.set(sessionId, entry);
  sessionIdByWorkerId.set(entry.workerId, sessionId);
};

/**
 * SessionId から取得
 */
export const getSessionBySessionId = (sessionId: string): McpSession | undefined => {
  return sessionsBySessionId.get(sessionId);
};

/**
 * WorkerId から取得
 */
export const getSessionByWorkerId = (workerId: string): McpSession | undefined => {
  const sessionId = sessionIdByWorkerId.get(workerId);
  if (!sessionId) return undefined;

  return sessionsBySessionId.get(sessionId);
};

/**
 * WorkerId -> SessionId のみ取得したい場合
 */
export const getSessionIdByWorkerId = (workerId: string): string | undefined => {
  return sessionIdByWorkerId.get(workerId);
};

/**
 * WorkerId から削除
 */
export const removeSessionByWorkerId = (workerId: string) => {
  const sessionId = sessionIdByWorkerId.get(workerId);
  if (!sessionId) return;

  sessionIdByWorkerId.delete(workerId);
  sessionsBySessionId.delete(sessionId);
};

export const removeSession = (sessionId: string) => {
  const session = sessionsBySessionId.get(sessionId);
  if (!session) return;

  sessionsBySessionId.delete(sessionId);
  sessionIdByWorkerId.delete(session.workerId);
};
