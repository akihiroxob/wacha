import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "@mcp/createMcpServer.ts";
import { MCP_HEADER } from "@constants/McpHeader.ts";
import { sessionService, membershipService } from "@container";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import PageCtrl from "@controller/PageController.ts";
import { ValidationError } from "@application/error/ValidationError.ts";
import { NotFoundError } from "@application/error/NotFoundError.ts";
import { SessionInvalidError } from "@application/error/SessionInvalidError.ts";
import { toMcpErrorResponse } from "@mcp/utils/toMcpErrorResponse.ts";

export const createApp = () => {
  const app = new Hono();
  app.use(logger());
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        MCP_HEADER.MCP_SESSION_ID,
        MCP_HEADER.MCP_PROTOCOL_VERSION,
        MCP_HEADER.LAST_EVENT_ID,
      ],
      exposeHeaders: [MCP_HEADER.MCP_SESSION_ID, MCP_HEADER.MCP_PROTOCOL_VERSION],
    }),
  );

  const root = fileURLToPath(new URL("../public", import.meta.url));
  app.use("/*", serveStatic({ root }));

  // API Routes
  app.get("/api/projects", PageCtrl.index.bind(PageCtrl));
  app.get("/api/projects/:projectId", PageCtrl.project.bind(PageCtrl));
  app.post("/api/projects/:projectId/stories", PageCtrl.createStory.bind(PageCtrl));
  app.put("/api/projects/:projectId/stories/:storyId", PageCtrl.updateStory.bind(PageCtrl));
  app.delete("/api/projects/:projectId/stories/:storyId", PageCtrl.deleteStory.bind(PageCtrl));
  app.put("/api/projects/:projectId/tasks/:taskId", PageCtrl.updateTask.bind(PageCtrl));
  app.delete("/api/projects/:projectId/tasks/:taskId", PageCtrl.deleteTask.bind(PageCtrl));
  app.post("/api/projects/:projectId/tasks/:taskId/accept", PageCtrl.acceptTask.bind(PageCtrl));
  app.post("/api/projects/:projectId/tasks/:taskId/reject", PageCtrl.rejectTask.bind(PageCtrl));
  app.post("/api/projects/:projectId/tasks/:taskId/cancel", PageCtrl.cancelTask.bind(PageCtrl));
  app.post(
    "/api/projects/:projectId/tasks/:taskId/comments",
    PageCtrl.addTaskComment.bind(PageCtrl),
  );
  app.all("/api/*", (c) => c.json({ error: { message: "Not Found" } }, 404));

  // MCP Route
  app.all("/mcp", async (c) => {
    // Sessionがある場合の処理
    //-----------------------------------------------------------------------------
    const sessionId = c.req.header(MCP_HEADER.MCP_SESSION_ID);
    if (sessionId) {
      const session = sessionService.getSessionBySessionId(sessionId);
      if (!session) throw new SessionInvalidError();
      return session.transport.handleRequest(c.req.raw);
    }

    // Sessionがない場合の処理
    //-----------------------------------------------------------------------------
    const parsedBody = await c.req.raw
      .clone()
      .json()
      .catch(() => null);
    if (!parsedBody) throw new ValidationError("Invalid JSON body");
    if (!isInitializeRequest(parsedBody)) throw new ValidationError("Initialization required");

    const initialSessionId = crypto.randomUUID();
    const server = createMcpServer({ sessionId: initialSessionId });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => initialSessionId,
      onsessioninitialized: (initializedSessionId) => {
        sessionService.registerSession(initializedSessionId, {
          server,
          transport,
          sessionId: initializedSessionId,
        });
      },
      onsessionclosed: (closedSessionId) => {
        sessionService.removeSessionBySessionId(closedSessionId);
        membershipService.removeMembershipBySessionId(closedSessionId).catch((error) => {
          console.error(
            `Failed to remove project memberships for session ${closedSessionId}`,
            error,
          );
        });

        console.info(`Session ${closedSessionId} closed and removed from session service`);
      },
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw, { parsedBody });
  });

  app.get("/health", (c) => c.json({ status: "ok", service: "wacha-mcp" }));

  // SPA fallback: 未知のGETパスには index.html を返す(/api・/mcp・/health は上で処理済み)
  app.get("*", serveStatic({ root, path: "index.html" }));

  // app error handling
  app.onError((err, c) => {
    console.error("Unexpected error:", err);
    if (c.req.path.startsWith("/api")) {
      const status = err instanceof ValidationError ? 400 : err instanceof NotFoundError ? 404 : 500;
      const message = err instanceof Error ? err.message : "Internal Server Error";
      return c.json({ error: { message } }, status);
    }
    const response = toMcpErrorResponse(err);
    return c.json(response.body, response.status);
  });

  return app;
};
