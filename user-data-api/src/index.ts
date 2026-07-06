import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";

const app = createApp();

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    logger.info(`user-data-api listening on port ${config.port}`);
  });
}

export default app;

