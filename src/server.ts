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
import { managerGuardHeader } from "@mcp/managerGuard.ts";
import {
  getSession,
  registerSession,
  removeSession,
  setSessionWorkerId,
} from "@mcp/sessionRegistry.ts";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import PageController from "@controller/PageController.ts";

const app = new Hono();
app.use(logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "mcp-session-id",
      "mcp-protocol-version",
      "last-event-id",
      managerGuardHeader,
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
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
  const sessionId = c.req.header("mcp-session-id");
  const workerId = c.req.header(managerGuardHeader)?.trim() || undefined;

  if (sessionId) {
    const session = getSession(sessionId);
    if (!session) {
      return c.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Invalid session ID" }, id: null },
        400,
      );
    }

    if (workerId) {
      setSessionWorkerId(sessionId, workerId);
    }

    return session.transport.handleRequest(c.req.raw);
  }

  if (c.req.method !== "POST") {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Initialization required" }, id: null },
      400,
    );
  }

  const parsedBody = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  if (!isInitializeRequest(parsedBody)) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Initialization required" }, id: null },
      400,
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (initializedSessionId) => {
      registerSession(initializedSessionId, { server, transport, workerId });
    },
    onsessionclosed: (closedSessionId) => {
      removeSession(closedSessionId);
    },
  });
  const server = createMcpServer();
  await server.connect(transport);

  return transport.handleRequest(c.req.raw, { parsedBody });
});

// Mcp Routes
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "wacha-mcp",
  }),
);

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 }, (info) => {
  console.log(`Server running at ${info.address}:${info.port}`);
});
