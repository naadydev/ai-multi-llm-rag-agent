// MUST be the very first import: populates process.env from .env before
// any LangChain / LangSmith module loads. Those SDKs read tracing and API-
// key vars from process.env at module init — if we load them after, tracing
// silently stays off. @fastify/env parses .env into app.config but does NOT
// write to process.env, so we need dotenv here for the SDK side.
//
// Reference uses `import "dotenv/config"` at the top of the entry file —
// that's the cleanest fix because it populates process.env before
// LangChain/LangSmith modules load. We do the same here.
//   See: ai-agents-course/02-personal-assistant/server/index.js (line 1)
import 'dotenv/config';
import { buildApp } from './app.js';

// Entry point — build, listen, and wire graceful shutdown.
const app = await buildApp();

// #region Listen
try {
  await app.listen({ host: app.config.HOST, port: app.config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
// #endregion

// #region Graceful shutdown
// Fastify's close() drains in-flight requests and runs onClose hooks before
// exit — important so any open file handles / Pinecone clients flush cleanly.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  });
}
// #endregion
