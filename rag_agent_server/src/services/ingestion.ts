import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PineconeStore } from '@langchain/pinecone';
import type { Document } from '@langchain/core/documents';
import type { FastifyBaseLogger } from 'fastify';
import { getEmbeddings, getPineconeIndex } from './pinecone.js';
import type { AppEnv } from '../config.js';

// #region Types
export interface IngestResult {
  documentId: string;
  pages: number;
  chunks: number;
}

export interface IngestInput {
  documentId: string;
  filePath: string;
  filename: string;
  size: number;
}
// #endregion

/**
 * Full PDF → Pinecone ingestion pipeline.
 *
 * Steps: load → split → enrich metadata → embed → index.
 * Each document gets its own Pinecone namespace (keyed by documentId) so
 * deletion is a single `index.namespace(id).deleteAll()` call.
 */
export async function ingestPdf(
  input: IngestInput,
  config: AppEnv,
  log: FastifyBaseLogger,
): Promise<IngestResult> {
  log.info({ documentId: input.documentId, filename: input.filename }, '[ingest 1] start');

  // #region Load PDF
  // splitPages:true gives one Document per page — lets us carry page numbers
  // into chunk metadata for citation-style retrieval later.
  const loader = new PDFLoader(input.filePath, { splitPages: true });
  const pages = await loader.load();
  log.info({ documentId: input.documentId, pages: pages.length }, '[ingest 2] pdf loaded');
  // #endregion

  // #region Split into chunks
  // Recursive splitter walks separator priority (\n\n, \n, space, char) so
  // chunks break on semantic boundaries when possible.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.FILE_CHUNK_SIZE,
    chunkOverlap: config.FILE_CHUNK_OVERLAP,
  });
  const chunks: Document[] = await splitter.splitDocuments(pages);
  log.info(
    {
      documentId: input.documentId,
      chunks: chunks.length,
      chunkSize: config.FILE_CHUNK_SIZE,
      chunkOverlap: config.FILE_CHUNK_OVERLAP,
    },
    '[ingest 3] split into chunks',
  );
  // #endregion

  // #region Enrich metadata
  // Promote the page number out of PDFLoader's nested `loc` shape so retrieval
  // code doesn't need to know about that structure. documentId + filename let
  // callers trace a chunk back to its source.
  for (const chunk of chunks) {
    chunk.metadata = {
      ...chunk.metadata,
      documentId: input.documentId,
      filename: input.filename,
      page: chunk.metadata?.loc?.pageNumber ?? null,
    };
  }
  // #endregion

  // #region Build vector store
  // Embeddings + client come from the shared pinecone service so ingestion
  // and retrieval can't drift onto different models or client instances.
  // The index must already exist and be provisioned with a dimension that
  // matches EMBEDDING_MODEL.
  const store = await PineconeStore.fromExistingIndex(getEmbeddings(config), {
    pineconeIndex: getPineconeIndex(config),
    namespace: input.documentId,
  });
  // #endregion

  // #region Index chunks (batched + idempotent)
  // Stable ids make re-ingest idempotent: a retry upserts the same vectors
  // rather than duplicating them. Batching respects Pinecone's per-request
  // vector limit.
  const ids = chunks.map((_, i) => `${input.documentId}-${i}`);
  const batch = config.PINECONE_BATCH_SIZE;
  for (let i = 0; i < chunks.length; i += batch) {
    await store.addDocuments(chunks.slice(i, i + batch), {
      ids: ids.slice(i, i + batch),
    });
  }
  // #endregion

  log.info(
    { documentId: input.documentId, chunks: chunks.length },
    '[ingest 4] indexed to pinecone',
  );

  return {
    documentId: input.documentId,
    pages: pages.length,
    chunks: chunks.length,
  };
}
