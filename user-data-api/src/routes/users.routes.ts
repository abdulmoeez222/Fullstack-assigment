import { Router, type Request, type Response } from "express";
import type { User } from "../types/user";
import { createUser, fetchUserFromDb } from "../data/mockUsers";
import { LRUCache } from "../cache/LRUCache";
import { CacheStats } from "../cache/cacheStats";
import { SingleFlight } from "../concurrency/singleFlight";
import { RequestQueue } from "../queue/requestQueue";
import { config } from "../config";
import { logger } from "../utils/logger";

export const userCache = new LRUCache<User>(config.cache.maxEntries, config.cache.ttlMs);
export const cacheStats = new CacheStats();

const singleFlight = new SingleFlight<User | null>();
const dbQueue = new RequestQueue<User | null>(20);

export const usersRouter = Router();

function cacheKey(id: number): string {
  return `user:${id}`;
}

usersRouter.get("/users/:id", async (req: Request, res: Response) => {
  const start = Date.now();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Bad Request", message: "User id must be a positive integer." });
    return;
  }

  const key = cacheKey(id);
  const cached = userCache.get(key);

  if (cached !== undefined) {
    cacheStats.recordHit();
    cacheStats.recordResponseTime(Date.now() - start);
    res.json(cached);
    return;
  }

  cacheStats.recordMiss();

  try {
    // Single-flight collapses concurrent requests for the same id into one
    // underlying fetch; the queue bounds how many simulated DB calls run
    // concurrently across *all* ids.
    const user = await singleFlight.run(key, () => dbQueue.enqueue(() => fetchUserFromDb(id)));

    cacheStats.recordResponseTime(Date.now() - start);

    if (!user) {
      res.status(404).json({ error: "Not Found", message: `No user with id ${id}.` });
      return;
    }

    // Only cache if not already cached (a concurrent request may have
    // populated it while we were awaiting single-flight).
    if (!userCache.has(key)) {
      userCache.set(key, user);
    }

    res.json(user);
  } catch (err) {
    logger.error("Failed to fetch user", { id, err: err instanceof Error ? err.message : err });
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch user data." });
  }
});

usersRouter.post("/users", (req: Request, res: Response) => {
  const { name, email } = req.body as { name?: unknown; email?: unknown };

  if (typeof name !== "string" || name.trim() === "" || typeof email !== "string" || email.trim() === "") {
    res.status(400).json({
      error: "Bad Request",
      message: "Both 'name' and 'email' are required strings.",
    });
    return;
  }

  const user = createUser(name.trim(), email.trim());
  userCache.set(cacheKey(user.id), user);

  res.status(201).json(user);
});
