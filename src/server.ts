import "@bootstrap/loadEnv.ts";
import "@bootstrap/initialize.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { createMcpServer } from "@mcp/createMcpServer.ts";
import { managerGuardHeader } from "@mcp/managerGuard.ts";
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

app.all("/mcp", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
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
