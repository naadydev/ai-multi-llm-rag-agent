import type { FastifyEnvOptions } from '@fastify/env';

// #region Env schema
// JSON schema consumed by @fastify/env. Values are loaded from process.env
// (and .env via dotenv). Anything listed in `required` must be set or the app
// will refuse to start — catches misconfigured deployments early.
export const envSchema = {
  type: 'object',
  required: ['PORT', 'HOST', 'OPENAI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX'],
  properties: {
    // Runtime
    NODE_ENV: { type: 'string', default: 'development' },
    HOST: { type: 'string', default: '0.0.0.0' },
    PORT: { type: 'number', default: 3000 },
    LOG_LEVEL: { type: 'string', default: 'info' },
    // Comma-separated list of allowed origins, or '*' to reflect any origin.
    CORS_ORIGIN: { type: 'string', default: '*' },

    // LLM + vector store credentials
    OPENAI_API_KEY: { type: 'string' },
    PINECONE_API_KEY: { type: 'string' },
    PINECONE_INDEX: { type: 'string' },

    // Ingestion pipeline tuning
    EMBEDDING_MODEL: { type: 'string', default: 'llama-text-embed-v2' },
    FILE_PROCESSING_DIR: { type: 'string', default: 'tmp/uploads' },
    FILE_CHUNK_SIZE: { type: 'number', default: 1000 },
    FILE_CHUNK_OVERLAP: { type: 'number', default: 200 },
    PINECONE_BATCH_SIZE: { type: 'number', default: 100 },
    MAX_UPLOAD_BYTES: { type: 'number', default: 20 * 1024 * 1024 },

    // Chat agent tuning
    // CHAT_MODEL is the OpenAI model id used when provider === 'openai'.
    CHAT_MODEL: { type: 'string', default: 'gpt-4o-mini' },
    CHAT_TOP_K: { type: 'number', default: 10 },
    CHAT_TEMPERATURE: { type: 'number', default: 0 },

    // --- Ollama (local LLM) settings ----------------------------------------
    // Used only when the chat request specifies provider === 'ollama'.
    // OLLAMA_BASE_URL points at the local Ollama daemon (started by
    // `ollama serve`). OLLAMA_CHAT_MODEL is the tag pulled with `ollama pull`.
    // We deliberately keep these separate from CHAT_MODEL/OPENAI_API_KEY so
    // both providers can be configured side-by-side for learning/comparison.
    OLLAMA_BASE_URL: { type: 'string', default: 'http://localhost:11434' },
    OLLAMA_CHAT_MODEL: { type: 'string', default: 'qwen3.5:2b' },
  },
} as const;
// #endregion

// #region Types
// Strongly-typed view of the validated env, exposed on the Fastify instance as
// `app.config` via the module augmentation below.
export interface AppEnv {
  NODE_ENV: string;
  HOST: string;
  PORT: number;
  LOG_LEVEL: string;
  CORS_ORIGIN: string;
  OPENAI_API_KEY: string;
  PINECONE_API_KEY: string;
  PINECONE_INDEX: string;
  EMBEDDING_MODEL: string;
  CHAT_MODEL: string;
  CHAT_TOP_K: number;
  CHAT_TEMPERATURE: number;
  FILE_PROCESSING_DIR: string;
  FILE_CHUNK_SIZE: number;
  FILE_CHUNK_OVERLAP: number;
  PINECONE_BATCH_SIZE: number;
  MAX_UPLOAD_BYTES: number;
  // Ollama (local LLM) — see envSchema for details.
  OLLAMA_BASE_URL: string;
  OLLAMA_CHAT_MODEL: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppEnv;
  }
}
// #endregion

// #region Plugin options
// Passed to app.register(env, envOptions). `confKey: 'config'` places the
// parsed env on app.config; `dotenv: true` auto-loads a .env file in dev.
export const envOptions: FastifyEnvOptions = {
  confKey: 'config',
  schema: envSchema,
  dotenv: true,
};
// #endregion
