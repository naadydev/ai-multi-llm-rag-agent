import type { FastifyPluginAsync } from 'fastify';

// #region Health route
// Liveness probe — intentionally unversioned so monitoring systems don't have
// to change paths across API revisions.
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));
};
// #endregion
