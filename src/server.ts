import "@bootstrap/loadEnv.ts";
import "@bootstrap/initialize.ts";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { membershipService } from "@container";

const app = createApp();

membershipService.clear().catch((error) => {
  console.error("Failed to clear project memberships on server start", error);
});

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 51743 }, (info) => {
  console.log(`Server running at ${info.address}:${info.port}`);
});
