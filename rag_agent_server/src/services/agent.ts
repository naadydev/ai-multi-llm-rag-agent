// #region Design notes
// Scoping
//   Ingestion stores each PDF in its own Pinecone namespace (= documentId),
//   so the retriever needs that id to know where to look. `buildAgent`
//   therefore accepts an OPTIONAL `documentId`:
//     - present → the agent is handed a retrieval tool bound to that
//                 namespace (RAG mode, single-doc scope).
//     - absent  → no tools; the agent answers from the LLM's own knowledge.
//   Cross-document search is deliberately not supported here — that would
//   need a shared namespace + metadata filters (see ingestion service).
//
// Memory
//   Conversations are thread-scoped via langgraph's MemorySaver, keyed by
//   `thread_id` (set at invoke time). The checkpointer is a module-level
//   singleton so every invocation in the process shares the same store.
//   MemorySaver is in-process only; swap for a Postgres/Redis-backed
//   checkpointer to survive restarts or run multiple instances.
//
// Streaming
//   Not implemented in v1 — callers use `agent.invoke(...)`. Easy to add
//   later with SSE + agent.stream(), but kept simple for now.
// #endregion

import { ChatOpenAI } from '@langchain/openai';
// LEARNING NOTE
// `@langchain/ollama` is the LangChain adapter for a locally-running Ollama
// server. It implements the same `BaseChatModel` interface as `ChatOpenAI`,
// which is why we can swap one for the other below without changing the
// rest of the agent wiring (tools, prompt, checkpointer all stay the same).
import { ChatOllama } from '@langchain/ollama';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import type { FastifyBaseLogger } from 'fastify';
import { buildRetrieverTool } from './tools.js';
import { CHAT_SYSTEM_PROMPT } from '../prompts.js';
import type { AppEnv } from '../config.js';

// LEARNING NOTE
// Single source of truth for the supported chat-LLM providers. Both the
// route layer (zod enum) and the frontend type union mirror this. To add a
// new provider (e.g. 'anthropic'), extend this union, add a branch in
// `buildAgent`, and update the zod schema in routes/v1/chat.ts.
export type LlmProvider = 'openai' | 'ollama';

// #region Module singletons
// Shared across the process lifetime — the checkpointer is stateful
// (holds conversation history) and must be the same instance every time
// we build an agent, or memory won't persist across requests.
//
// PRODUCTION NOTE
//   `MemorySaver` stores threads in-process RAM. That is fine for local dev
//   and single-instance test environments, but it has three problems for a
//   real deployment:
//     1. Restarts / crashes wipe every conversation.
//     2. Horizontal scaling breaks — two replicas behind a load balancer
//        each have their own memory, so a follow-up request can land on a
//        node that has never seen the thread.
//     3. No retention controls, audit trail, or cross-user isolation.
//
//   For production swap to a DB-backed BaseCheckpointSaver — e.g.
//   `@langchain/langgraph-checkpoint-postgres` (PostgresSaver) or
//   `@langchain/langgraph-checkpoint-sqlite` for smaller setups. Redis-
//   backed options exist too. The rest of this file stays the same:
//   `createAgent` accepts any BaseCheckpointSaver, so it's a one-line
//   swap plus wiring the connection string through config.
export const checkpointer = new MemorySaver();
// #endregion

// #region Agent factory
// Assembles the ReAct agent (LLM + optional retriever tool + shared
// checkpointer). Cheap — safe to call per request. Callers drive it via
// `.invoke(...)` or `.stream(...)` and pass `thread_id` in the runtime config.
export function buildAgent(
  config: AppEnv,
  documentId?: string,
  log?: FastifyBaseLogger,
  // LEARNING NOTE
  // `provider` defaults to 'openai' so any caller that hasn't been updated
  // (older clients, tests, scripts) keeps the original behavior. New callers
  // pass 'ollama' to route the same agent through a local Ollama model.
  provider: LlmProvider = 'openai',
) {
  // #region LLM selection (provider switch)
  // Both branches construct a `BaseChatModel` — the rest of the agent code
  // (tools, prompt, checkpointer) is identical for either provider. Keeping
  // the two branches side-by-side here makes it easy to compare the two
  // SDKs, and to add a third provider later without touching anything else.
  let llm;
  let modelLabel: string;
  if (provider === 'ollama') {
    // --- Ollama (local) -------------------------------------------------
    // Talks HTTP to the Ollama daemon at OLLAMA_BASE_URL. No API key — the
    // model runs on your own machine. `model` must match a tag you've
    // already pulled with `ollama pull <name>`.
    //
    // LEARNING NOTE — `think: false`
    // Some Ollama models (qwen3, qwen3.5, deepseek-r1, …) are "reasoning"
    // models that emit a long internal monologue before the actual answer.
    // For a simple chat/RAG agent that's pure overhead — turns take minutes
    // and can blow past timeouts. Setting `think: false` tells Ollama to
    // skip the thinking phase and stream the final answer directly. Models
    // that don't have a thinking mode just ignore the flag, so it's safe
    // to leave on by default.
    llm = new ChatOllama({
      baseUrl: config.OLLAMA_BASE_URL,
      model: config.OLLAMA_CHAT_MODEL,
      temperature: config.CHAT_TEMPERATURE,
      think: false,
    });
    modelLabel = config.OLLAMA_CHAT_MODEL;
  } else {
    // --- OpenAI (hosted, default) ---------------------------------------
    // Original code path. `apiKey` comes from the OPENAI_API_KEY env var
    // (validated at boot in config.ts). Billed per token.
    llm = new ChatOpenAI({
      apiKey: config.OPENAI_API_KEY,
      model: config.CHAT_MODEL,
      temperature: config.CHAT_TEMPERATURE,
    });
    modelLabel = config.CHAT_MODEL;
  }
  // #endregion

  const tools = documentId ? [buildRetrieverTool(documentId, config, log)] : [];

  // Learning log: tells you which provider+model is in use, the temperature
  // (0 == deterministic replies, useful for RAG), and whether the retrieval
  // tool is attached for this turn (RAG mode) or not (plain chat).
  log?.info(
    {
      provider,
      model: modelLabel,
      temperature: config.CHAT_TEMPERATURE,
      rag: tools.length > 0,
      toolCount: tools.length,
    },
    '[chat 2] agent built',
  );

  return createAgent({
    model: llm,
    tools,
    systemPrompt: CHAT_SYSTEM_PROMPT,
    checkpointer,
  });
}
// #endregion
