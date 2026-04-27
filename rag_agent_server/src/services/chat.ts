import type { AIMessage, BaseMessage } from '@langchain/core/messages';
import type { FastifyBaseLogger } from 'fastify';
import { buildAgent, type LlmProvider } from './agent.js';
import type { AppEnv } from '../config.js';

// #region Types
export interface ChatInput {
  message: string;
  threadId: string;
  documentId?: string;
  // LEARNING NOTE
  // Optional so existing callers / tests keep working. When undefined the
  // agent layer falls back to its 'openai' default.
  provider?: LlmProvider;
}

export interface ChatResult {
  threadId: string;
  message: string;
  // We echo the resolved provider back so the UI can display/badge which
  // model actually answered (useful when comparing OpenAI vs. Ollama).
  provider: LlmProvider;
}
// #endregion

// #region Public API
// Thin orchestration over the agent: build it, invoke it for this thread,
// pull the final assistant message out of the response. Anything agent-shaped
// (tools, prompt, checkpointer) lives in agent.ts — this file is the
// chat-endpoint-specific glue.
export async function runChat(
  input: ChatInput,
  config: AppEnv,
  log: FastifyBaseLogger,
): Promise<ChatResult> {
  // Resolve provider once so we can both forward it to the agent and echo
  // it back in the response. 'openai' is the historical default.
  const provider: LlmProvider = input.provider ?? 'openai';

  log.info(
    { threadId: input.threadId, documentId: input.documentId ?? null, provider },
    '[chat 1] start',
  );

  const agent = buildAgent(config, input.documentId, log, provider);

  // `thread_id` does double duty:
  //   (1) keys the langgraph MemorySaver so the agent sees prior turns, and
  //   (2) is picked up by LangSmith's tracer and used to group runs in the
  //       Threads view as a single conversation. See the observability
  //       comment in app.ts for the full wiring story.
  const result = await agent.invoke(
    { messages: [{ role: 'user', content: input.message }] },
    { configurable: { thread_id: input.threadId } },
  );

  // Extract the final assistant message. Content can be a plain string or an
  // array of content blocks (multimodal / tool-augmented responses) — we
  // concatenate any text blocks and ignore non-text parts.
  const messages = result.messages as BaseMessage[];
  const last = messages[messages.length - 1] as AIMessage | undefined;
  const text =
    typeof last?.content === 'string'
      ? last.content
      : Array.isArray(last?.content)
        ? last.content
            .map((c) => {
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object' && 'text' in c && typeof c.text === 'string') {
                return c.text;
              }
              return '';
            })
            .join('')
        : '';

  // Learning log: messages is the full conversation *plus* any tool calls
  // and tool results the agent generated this turn. Counting types helps
  // you see, e.g., that one user message produced [AI→tool_call → tool →
  // AI→final] — four messages for one turn when retrieval happened.
  const byType = messages.reduce<Record<string, number>>((acc, m) => {
    const t = m.getType?.() ?? 'unknown';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  log.info(
    { threadId: input.threadId, totalMessages: messages.length, byType },
    '[chat 5] done',
  );

  return { threadId: input.threadId, message: text, provider };
}
// #endregion
