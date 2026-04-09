import "@bootstrap/loadEnv.ts";
import "@bootstrap/initialize.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "@mcp/createMcpServer.ts";
import { MCP_HEADER } from "@constants/McpHeader.ts";
import { sessionService, membershipService } from "@container";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import PageController from "@controller/PageController.ts";
import { ValidationError } from "@application/error/ValidationError.ts";

const app = new Hono();
app.use(logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
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

// Page Routes
app.get("/", PageController.index);
app.get("/project/:projectId", PageController.project);
app.get("/project/:projectId/story/add", PageController.addStory);
app.post("/project/:projectId/story", PageController.createStory);
app.post("/project/:projectId/story/:storyId/delete", PageController.deleteStory);
app.post("/project/:projectId/task/:taskId/delete", PageController.deleteTask);

// MCP Route
app.all("/mcp", async (c) => {
  // Postのみサポート
  // if (c.req.method !== "POST") throw new ValidationError(`Unsupported method: ${c.req.method}`);

  // Sessionがある場合の処理
  //-----------------------------------------------------------------------------
  const sessionId = c.req.header(MCP_HEADER.MCP_SESSION_ID);
  if (sessionId) {
    const session = sessionService.getSessionBySessionId(sessionId);
    if (!session) throw new ValidationError("Invalid session ID");
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
        console.error(`Failed to remove project memberships for session ${closedSessionId}`, error);
      });

      console.info(`Session ${closedSessionId} closed and removed from session service`);
    },
  });

  await server.connect(transport);
  return transport.handleRequest(c.req.raw, { parsedBody });
});

app.get("/health", (c) => c.json({ status: "ok", service: "wacha-mcp" }));

// app error handling
app.onError((err, c) => {
  console.error("Unexpected error:", err);
  const status = err instanceof ValidationError ? 400 : 500;

  return c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: err.message || "Internal Server Error",
      },
      id: null,
    },
    status,
  );
});

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 }, (info) => {
  console.log(`Server running at ${info.address}:${info.port}`);
});
