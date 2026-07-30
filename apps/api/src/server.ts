import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initSocketIO } from './websocket/socket.handler';
import { startCronJobs } from './jobs/cron.jobs';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketIO(httpServer);
  startCronJobs();

  const PORT = Number(process.env.PORT) || env.API_PORT;
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`API running on port ${PORT}`);
    logger.info(`Swagger docs: ${env.API_URL}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down...`);
    httpServer.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
