// Shared client-side types. Mirrors the server's response shapes — if you
// change the backend, update these too.

export interface IngestResponse {
  documentId: string;
  pages: number;
  chunks: number;
  filename: string;
  size: number;
}

// LEARNING NOTE
// Mirrors the union in `rag_agent_server/src/services/agent.ts` (LlmProvider)
// and the zod enum in the chat route. Keep all three in sync when adding a
// new provider — TypeScript will not catch a drift across the network.
export type LlmProvider = 'openai' | 'ollama';

export interface ChatResponse {
  threadId: string;
  message: string;
  // The server echoes back which provider actually answered this turn so
  // the UI can confirm/badge the choice.
  provider?: LlmProvider;
}

export interface Doc {
  id: string;        // documentId from the server (= Pinecone namespace)
  filename: string;
  pages: number;
  chunks: number;
  size: number;
  uploadedAt: number;
}

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  at: number;
}
