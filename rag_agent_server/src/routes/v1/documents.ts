import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { getPineconeIndex } from '../../services/pinecone.js';

export const documentRoutes: FastifyPluginAsync = async (app) => {
  // #region DELETE /documents/:id
  // Wipes every vector for a document from its Pinecone namespace and best-
  // effort deletes the source PDF on disk. Idempotent — deleting an
  // already-gone doc still returns 204.
  app.delete<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
    const documentId = req.params.id;

    // Pinecone: namespace-scoped delete. `deleteAll()` on a missing namespace
    // is a no-op, so retries and phantom-ids don't error.
    try {
      await getPineconeIndex(app.config).namespace(documentId).deleteAll();
    } catch (err) {
      req.log.error({ err, documentId }, 'delete: pinecone failed');
      throw app.httpErrors.internalServerError('delete failed');
    }

    // Disk: remove the uploaded PDF. Missing file is fine — the ingest route
    // uses the same `${documentId}.pdf` naming convention.
    const filePath = path.resolve(
      process.cwd(),
      app.config.FILE_PROCESSING_DIR,
      `${documentId}.pdf`,
    );
    await unlink(filePath).catch(() => {});

    req.log.info({ documentId }, 'document deleted');
    return reply.code(204).send();
  });
  // #endregion
};
