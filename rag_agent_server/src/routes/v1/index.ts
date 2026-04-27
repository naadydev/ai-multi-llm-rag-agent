import type { FastifyPluginAsync } from 'fastify';
import { ingestRoutes } from './ingest.js';
import { chatRoutes } from './chat.js';
import { documentRoutes } from './documents.js';

// Aggregator for everything mounted under /api/v1. Register new v1 feature
// plugins here — keeps app.ts free of per-feature imports.
export const v1Routes: FastifyPluginAsync = async (app) => {
  // #region Smoke route
  app.get('/hello', async (req) => ({
    message: 'hello from fastify',
    requestId: req.id,
  }));
  // #endregion

  // #region Feature routes
  await app.register(ingestRoutes);
  await app.register(chatRoutes);
  await app.register(documentRoutes);
  // #endregion
};
