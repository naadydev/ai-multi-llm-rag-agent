import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyPluginAsync } from 'fastify';
import { ingestPdf } from '../../services/ingestion.js';
import { PDF_MAGIC_BYTES, PDF_MIME_TYPE } from '../../constants.js';

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  // #region Setup
  // Resolve the upload dir relative to CWD and ensure it exists at boot so the
  // first request doesn't race on mkdir.
  const uploadDir = path.resolve(process.cwd(), app.config.FILE_PROCESSING_DIR);
  await mkdir(uploadDir, { recursive: true });
  // #endregion

  // #region POST /ingest
  app.post('/ingest', async (req, reply) => {
    // #region Read + validate multipart
    // File size is enforced at the plugin level (app.ts) — we only validate
    // presence and type here.
    const file = await req.file();
    if (!file) throw app.httpErrors.badRequest('file field is required');
    if (file.mimetype !== PDF_MIME_TYPE) {
      throw app.httpErrors.unsupportedMediaType(`only ${PDF_MIME_TYPE} is accepted`);
    }
    // #endregion

    // #region Stream to disk (with magic-byte check)
    // Use a UUID for the on-disk filename so colliding / malicious names can't
    // traverse the directory, and so the ID can key downstream work.
    const documentId = randomUUID();
    const destPath = path.join(uploadDir, `${documentId}.pdf`);

    let size = 0;
    let headerChecked = false;

    // Inline transform: inspect the first chunk, reject non-PDFs before any
    // bytes hit disk-indexing / embedding. Also accumulates total size.
    const checkHeader = async function* (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) {
        if (!headerChecked) {
          if (
            chunk.length < PDF_MAGIC_BYTES.length ||
            !chunk.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)
          ) {
            throw app.httpErrors.badRequest('file is not a valid PDF');
          }
          headerChecked = true;
        }
        size += chunk.length;
        yield chunk;
      }
    };

    try {
      await pipeline(file.file, checkHeader, createWriteStream(destPath));
    } catch (err) {
      // Pipeline error leaves a partial file behind — best-effort cleanup.
      await unlink(destPath).catch(() => {});
      if (file.file.truncated) {
        throw app.httpErrors.payloadTooLarge(
          `file exceeds ${app.config.MAX_UPLOAD_BYTES} bytes`,
        );
      }
      throw err;
    }
    // #endregion

    // #region Run ingestion pipeline
    // Synchronous: the request blocks until embedding + indexing finish. Fine
    // for test/small PDFs — for production, push this to a job queue and
    // respond 202 with the documentId.
    try {
      const result = await ingestPdf(
        { documentId, filePath: destPath, filename: file.filename, size },
        app.config,
        req.log,
      );
      return reply.code(201).send({
        ...result,
        filename: file.filename,
        size,
      });
    } catch (err) {
      req.log.error({ err, documentId }, 'ingest: pipeline failed');
      // Don't leave orphan files if indexing fails — the document was never
      // usable, so the upload is effectively discarded.
      await unlink(destPath).catch(() => {});
      throw app.httpErrors.internalServerError('ingestion failed');
    }
    // #endregion
  });
  // #endregion
};
