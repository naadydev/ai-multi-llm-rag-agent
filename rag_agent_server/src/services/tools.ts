// #region Overview
// Home for agent tools. Each exported factory builds a LangChain `tool`
// configured for a specific task — the agent layer just composes them.
// Keeping tools here (rather than inline in agent.ts) lets new tools be
// added without touching the agent wiring, and makes them unit-testable
// in isolation.
// #endregion

import { z } from 'zod';
import { PineconeStore } from '@langchain/pinecone';
import { tool } from 'langchain';
import type { FastifyBaseLogger } from 'fastify';
import { getEmbeddings, getPineconeIndex } from './pinecone.js';
import type { AppEnv } from '../config.js';

// #region Retriever tool
// Builds a semantic-search tool scoped to a single Pinecone namespace
// (= documentId). The scope is bound via closure so the LLM never sees
// — or needs to pass — a namespace argument, which keeps the attack
// surface small and the tool schema simple.
export function buildRetrieverTool(
  documentId: string,
  config: AppEnv,
  log?: FastifyBaseLogger,
) {
  const embeddings = getEmbeddings(config);
  const index = getPineconeIndex(config);

  return tool(
    async ({ query }) => {
      // Learning log: shows exactly what the LLM decided to search for.
      // Watch this to see how the model rewrites user questions into queries.
      log?.info({ documentId, query, topK: config.CHAT_TOP_K }, '[chat 3] tool(search_document) query');

      const store = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace: documentId,
      });
      // We fetch the top 10 (CHAT_TOP_K) most similar chunks to feed into the LLM as context for answering the user's question. The more chunks we fetch, the better the LLM's answer quality (up to a point), but it also increases latency and cost. Adjust CHAT_TOP_K in config to find the sweet spot for your use case.
      const docs = await store.similaritySearch(query, config.CHAT_TOP_K);

      // Learning log: see what actually came back. Preview trims long
      // passages so the console stays readable.
      log?.info(
        {
          documentId,
          hits: docs.length,
          preview: docs.slice(0, 3).map((d) => ({
            page: d.metadata?.page ?? null,
            text: d.pageContent.slice(0, 120) + (d.pageContent.length > 120 ? '…' : ''),
          })),
        },
        '[chat 4] tool(search_document) results',
      );

      if (docs.length === 0) return 'No relevant passages found in the document.';
      // Format as a numbered list with page citations so the LLM can
      // attribute claims back to specific pages in its final answer.
      return docs
        .map((d, i) => {
          const page = d.metadata?.page ?? 'unknown';
          return `[${i + 1}] (page ${page})\n${d.pageContent}`;
        })
        .join('\n\n');
    },
    {
      // Name the LLM sees when choosing a tool — keep it short and verb-led.
      name: 'search_document',
      // Description is how the LLM decides *when* to call this tool.
      // Be specific about what it searches and what it returns, so the
      // model doesn't guess. This string is part of the prompt at runtime.
      description:
        'Semantic search over the PDF the user uploaded. Use for any question about the document; returns the most relevant passages with page numbers.',
      schema: z.object({
        query: z.string().describe('A focused natural-language query.'),
      }),
    },
  );
}
// #endregion
