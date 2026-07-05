import express, { type Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { usersRouter, userCache } from "./routes/users.routes";
import { cacheRouter } from "./routes/cache.routes";
import { rateLimitMiddleware } from "./middleware/rateLimitMiddleware";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { startStaleSweeper } from "./cache/staleSweeper";
import { config } from "./config";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(rateLimitMiddleware);

  app.use(usersRouter);
  app.use(cacheRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Background cache cleanup — started here so tests that import createApp
  // multiple times don't leak intervals; caller can ignore the returned
  // stop function in production, since the process lifetime handles cleanup.
  startStaleSweeper(userCache, config.cache.sweepIntervalMs);

  return app;
}
