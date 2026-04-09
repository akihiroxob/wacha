import type { McpSession } from "@domain/model/McpSession.d.ts";
export const sessionsBySessionId = new Map<string, McpSession>();
export const sessionIdByWorkerId = new Map<string, string>();
