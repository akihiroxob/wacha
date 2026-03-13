import "@bootstrap/loadEnv.ts";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { initializeSchema } from "@database/initializeSchema.ts";

import { createMcpServer } from "@mcp/createMcpServer.ts";

await initializeSchema();

const app = new Hono();

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
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "wacha-mcp",
  }),
);

app.all("/mcp", async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createMcpServer();

  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 3100);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`MCP server running at http://${info.address}:${info.port}`);
  },
);
