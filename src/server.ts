import "@bootstrap/loadEnv.ts";
import "@bootstrap/initialize.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createMcpServer } from "@mcp/createMcpServer.ts";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import PageController from "@controller/PageController.ts";

const app = new Hono();
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "mcp-protocol-version", "last-event-id"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);
// Page Routes
app.get("/", PageController.index);
app.get("/styles/index.css", PageController.css);

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
