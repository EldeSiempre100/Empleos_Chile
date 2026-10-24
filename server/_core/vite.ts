import type { Express } from "express";
import type { Server } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import express from "express";

export async function setupVite(app: Express, server: Server): Promise<void> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (req.path.startsWith("/api/")) { next(); return; }
    try {
      const template = await fs.readFile(path.resolve("client/index.html"), "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) { next(error); }
  });
}
export function serveStatic(app: Express): void {
  const publicDir = path.resolve("dist/public");
  app.use(express.static(publicDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) { next(); return; }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
