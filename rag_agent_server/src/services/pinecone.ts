// #region Overview
// Shared Pinecone access: one client for the process lifetime and a helper
// that builds a matching PineconeEmbeddings instance. Any code that talks to
// Pinecone — ingestion, retrieval tools, future evaluators — should go
// through this module so the client lifetime and embedding model stay
// consistent across the app.
// #endregion

import { PineconeEmbeddings } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import type { AppEnv } from '../config.js';

// #region Client singleton
// The Pinecone SDK pools HTTP connections internally — recreating the client
// per request wastes handshakes and leaks sockets over time.
let client: Pinecone | null = null;

export function getPineconeClient(config: AppEnv): Pinecone {
  if (!client) client = new Pinecone({ apiKey: config.PINECONE_API_KEY });
  return client;
}

export function getPineconeIndex(config: AppEnv) {
  return getPineconeClient(config).Index(config.PINECONE_INDEX);
}
// #endregion

// #region Embeddings
// PineconeEmbeddings uses Pinecone's hosted inference API so we stay on
// whatever model the index was provisioned with (e.g. llama-text-embed-v2).
// CRITICAL: query-time and ingest-time embeddings MUST come from the same
// model — mismatched models produce vectors in different spaces and
// similarity search collapses to noise.
export function getEmbeddings(config: AppEnv): PineconeEmbeddings {
  // @langchain/pinecone's client helper throws unless PINECONE_API_KEY is on
  // process.env — even when we pass apiKey via config. Mirror it here so
  // both access paths agree. (@fastify/env with dotenv:true only populates
  // process.env when it finds a .env in the CWD; we can't rely on that when
  // the process is launched from a different working directory.)
  if (!process.env.PINECONE_API_KEY) process.env.PINECONE_API_KEY = config.PINECONE_API_KEY;
  return new PineconeEmbeddings({
    apiKey: config.PINECONE_API_KEY,
    model: config.EMBEDDING_MODEL,
  });
}
// #endregion
