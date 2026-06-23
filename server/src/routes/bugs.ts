import { Router } from "express";
import { db } from "../db/index.js";

export const bugsRouter = Router();

bugsRouter.get("/", (_req, res, next) => {
  try {
    const bugs = db
      .prepare(`SELECT id, description, context, created_at FROM bug_reports ORDER BY created_at DESC LIMIT 50`)
      .all();
    
    // Parse the context JSON before sending
    const parsedBugs = bugs.map((b: any) => {
      let parsedContext = b.context;
      try {
        parsedContext = JSON.parse(b.context);
      } catch {
        // Fallback if not valid JSON
      }
      return {
        id: b.id,
        description: b.description,
        context: parsedContext,
        created_at: b.created_at,
      };
    });

    res.json({ data: parsedBugs, error: null });
  } catch (err) {
    next(err);
  }
});

bugsRouter.post("/", (req, res, next) => {
  try {
    const { description, context } = req.body;
    if (typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ data: null, error: "Description is required" });
    }

    const contextStr = typeof context === "object" ? JSON.stringify(context) : String(context || "");
    
    const result = db
      .prepare("INSERT INTO bug_reports (description, context) VALUES (?, ?)")
      .run(description, contextStr);

    res.json({ data: { id: result.lastInsertRowid }, error: null });
  } catch (err) {
    next(err);
  }
});
