import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import { MEDIA_DIR } from "./server/src/db/index.js";
import { decksRouter } from "./server/src/routes/decks.js";
import { importsRouter } from "./server/src/routes/imports.js";
import { studyRouter } from "./server/src/routes/study.js";
import { correctionsRouter } from "./server/src/routes/corrections.js";
import { sourcesRouter } from "./server/src/routes/sources.js";
import { notesRouter } from "./server/src/routes/notes.js";
import { backupRouter } from "./server/src/routes/backup.js";
import { qaRouter } from "./server/src/routes/qa.js";

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/media", express.static(MEDIA_DIR));

  // Register API routers
  app.use("/api/decks", decksRouter);
  app.use("/api/import", importsRouter);
  app.use("/api/study", studyRouter);
  app.use("/api/corrections", correctionsRouter);
  app.use("/api/sources", sourcesRouter);
  app.use("/api/notes", notesRouter);
  app.use("/api/backup", backupRouter);
  app.use("/api/qa", qaRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ data: { ok: true }, error: null });
  });

  // Serve client assets
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in development middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static client assets from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(/^(?!\/api|\/media).*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[${new Date().toISOString()}] Unhandled error in ${req.method} ${req.url}:`, err);
    if (!res.headersSent) {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ data: null, error: err.message || "Internal server error" });
    }
  });

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
