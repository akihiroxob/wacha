import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { logError, logInfo } from "./infrastructure/logging/ApplicationLogger.ts";

let server: Server | undefined;
let shuttingDown = false;

const shutdown = (reason: string, exitCode: number) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logInfo("server_stopping", { reason, exitCode });

  if (!server?.listening) {
    process.exit(exitCode);
  }

  const forceExit = setTimeout(() => {
    logError("server_shutdown_timeout", new Error("Graceful shutdown timed out"), {
      reason,
      exitCode,
    });
    process.exit(exitCode || 1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    if (error) {
      logError("server_shutdown_error", error, { reason });
      process.exit(1);
    }

    logInfo("server_stopped", { reason, exitCode });
    process.exit(exitCode);
  });
};

process.once("SIGINT", () => shutdown("SIGINT", 0));
process.once("SIGTERM", () => shutdown("SIGTERM", 0));
process.once("uncaughtException", (error) => {
  logError("uncaught_exception", error);
  shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (reason) => {
  logError("unhandled_rejection", reason);
  shutdown("unhandledRejection", 1);
});

const start = async () => {
  await import("@bootstrap/loadEnv.ts");
  await import("@bootstrap/initialize.ts");
  const { createApp } = await import("./app.ts");
  const app = createApp();
  const port = Number(process.env.PORT) || 51743;

  server = serve({ fetch: app.fetch, port }, (info) => {
    logInfo("server_started", {
      address: info.address,
      port: info.port,
    });
  }) as Server;

  server.once("error", (error) => {
    logError("server_error", error, { port });
    shutdown("serverError", 1);
  });
};

start().catch((error) => {
  logError("server_startup_error", error);
  shutdown("startupError", 1);
});
