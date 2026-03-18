import { readFile } from "node:fs/promises";
import { Context } from "hono";
import { Index } from "@views/index.tsx";
import { renderToString } from "hono/jsx/dom/server";
import { listTaskUseCase } from "@container";

export class PageController {
  async index(c: Context) {
    const result = await listTaskUseCase.execute();
    const page = Index({ summary: result.summary, tasks: result.tasks });
    return c.html(`<!doctype html>${renderToString(page ?? "")}`);
  }

  async css(c: Context) {
    const cssPath = new URL("../../views/index.css", import.meta.url);
    const css = await readFile(cssPath, "utf-8");
    c.header("Content-Type", "text/css; charset=utf-8");
    return c.body(css);
  }
}

export default new PageController();
