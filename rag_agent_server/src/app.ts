import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import env from '@fastify/env';
import multipart from '@fastify/multipart';
import { envOptions } from './config.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes } from './routes/v1/index.js';

// Factory that builds (but does not start) the Fastify app. Kept separate from
// server.ts so tests can spin up an isolated instance via `inject()`.
export async function buildApp(): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV !== 'production';

  // #region Fastify instance
  // pino-pretty is only wired in dev — in prod we emit raw JSON logs so a log
  // shipper (Loki, Datadog, etc.) can parse them without extra work.
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: isDev
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
    },
  });
  // #endregion

  // #region Core plugins
  // Order matters: env must be registered first so downstream plugins and
  // routes can read app.config (e.g. multipart needs MAX_UPLOAD_BYTES).
  await app.register(env, envOptions);
  await app.register(sensible); // adds app.httpErrors.* helpers
  // CORS_ORIGIN is a comma-separated list; '*' means reflect any origin.
  const corsOrigin =
    app.config.CORS_ORIGIN === '*'
      ? true
      : app.config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  // @fastify/cors defaults methods to GET,HEAD,POST only — preflight blocks
  // DELETE/PUT/PATCH without this override. Listing every method we use
  // keeps the allowlist explicit rather than reflecting whatever the browser
  // asks for.
  await app.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(multipart, {
    limits: { fileSize: app.config.MAX_UPLOAD_BYTES, files: 1 },
  });
  // #endregion

  // #region Observability
  // How LangSmith is wired in this app
  // ---------------------------------
  // No code in this project imports `langsmith` or constructs a tracer. The
  // integration is entirely implicit — it hangs on three things:
  //
  //   1. .env → process.env
  //      @fastify/env (registered above) with `dotenv: true` loads the four
  //      LANGSMITH_* variables into process.env at boot. That's the on/off
  //      switch for the whole feature.
  //
  //   2. The `langsmith` npm package (pulled in transitively by `langchain`
  //      / `@langchain/core`)
  //      When ChatOpenAI, createAgent, PineconeEmbeddings, or tool(...) first
  //      runs, their internal handlers read process.env.LANGSMITH_* and
  //      attach a tracing callback. All the real work happens inside
  //      node_modules — we just use the primitives.
  //
  //   3. configurable.thread_id on agent.invoke(...)  (services/chat.ts)
  //      LangGraph propagates thread_id into run metadata, and LangSmith's
  //      Threads view groups runs by it. Without that one line, every turn
  //      would appear as an isolated run instead of a conversation.
  //
  // The log line below is purely diagnostic — it doesn't wire anything, it
  // just prints whether the env flags look right so you can see at startup
  // whether traces are flowing.
  if (process.env.LANGSMITH_TRACING === 'true' && process.env.LANGSMITH_API_KEY) {
    app.log.info(
      { project: process.env.LANGSMITH_PROJECT ?? 'default' },
      'langsmith tracing enabled',
    );
  } else {
    app.log.info('langsmith tracing disabled');
  }
  // #endregion

  // #region Routes
  // Health is unversioned (monitoring tools hit a stable path).
  // Versioned API lives under /api/v1 — add /api/v2 as a sibling when needed.
  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: '/api/v1' });
  // #endregion

  return app;
}
