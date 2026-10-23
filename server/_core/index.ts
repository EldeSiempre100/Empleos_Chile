import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    next();
  });
  // An 8 MB CV expands to roughly 11 MB in base64; keep the HTTP envelope bounded.
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: false }));
  const authWindow = new Map<string, { count: number; resetAt: number }>();
  const oauthRateLimit: express.RequestHandler = (req, res, next) => {
    const now = Date.now();
    const key = req.ip || "unknown";
    const previous = authWindow.get(key);
    if (!previous || previous.resetAt <= now)
      authWindow.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    else if (previous.count >= 30) {
      res
        .status(429)
        .json({
          error:
            "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
        });
      return;
    } else previous.count++;
    if (authWindow.size > 1000)
      for (const [ip, entry] of authWindow)
        if (entry.resetAt <= now) authWindow.delete(ip);
    next();
  };
  app.use("/api/oauth/callback", oauthRateLimit);
  const healthcheck: express.RequestHandler = async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ status: "error", database: "unavailable" });
        return;
      }
      await db.execute(sql`select 1`);
      res.status(200).json({ status: "ok", database: "ok" });
    } catch {
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  };
  app.get(["/health", "/api/health"], healthcheck);
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use("/api/trpc", (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }
    if (
      req.get("x-empleos-request") !== "1" ||
      req.get("sec-fetch-site") === "cross-site"
    ) {
      res.status(403).json({ error: "Solicitud de origen no permitida." });
      return;
    }
    next();
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
