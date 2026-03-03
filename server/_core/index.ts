import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleImportSanctions, handleGetImportLogs } from "../import-handler";
import { handleGeneratePdfReport } from "../pdf-report";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // ─── Excel Import Endpoint ───────────────────────────────────────────────────
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  // Auth middleware for import routes
  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
      if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });
      if (ctx.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
      (req as express.Request & { user: typeof ctx.user }).user = ctx.user;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.post("/api/admin/import-sanctions", requireAdmin, upload.single("file"), handleImportSanctions);
  app.get("/api/admin/import-logs", requireAdmin, handleGetImportLogs);

  // PDF Report (any authenticated user)
  app.get("/api/report/sanctions/:id", handleGeneratePdfReport);

  // tRPC API
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
