import { Router, type Request, type Response } from "express";
import { cacheStats, userCache } from "./users.routes";

export const cacheRouter = Router();

cacheRouter.delete("/cache", (_req: Request, res: Response) => {
  userCache.clear();
  cacheStats.reset();
  res.status(200).json({ message: "Cache cleared." });
});

cacheRouter.get("/cache-status", (_req: Request, res: Response) => {
  res.json(cacheStats.snapshot(userCache.size));
});
