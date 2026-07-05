import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled request error", { path: req.path, method: req.method, message });

  if (res.headersSent) return;

  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong processing your request.",
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "Not Found",
    message: `No route for ${req.method} ${req.path}`,
  });
}
