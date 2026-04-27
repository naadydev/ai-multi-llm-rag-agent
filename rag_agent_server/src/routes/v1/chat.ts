import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { runChat } from '../../services/chat.js';
import { classifyError } from '../../services/errors.js';

// #region Request schema
// Validated with zod — keeps route handler free of manual shape checking and
// produces a typed `body` via safeParse below. All fields other than `message`
// are optional: threadId is auto-generated on first turn, documentId enables
// the RAG retrieval tool when present.
const chatBodySchema = z.object({
  message: z.string().min(1, 'message is required'),
  threadId: z.string().uuid().optional(),
  documentId: z.string().min(1).optional(),
  // LEARNING NOTE
  // Optional, restricted enum. zod rejects any value other than the two
  // strings here with a 400 (handled below), so the service layer can trust
  // the value. Keep this list in sync with `LlmProvider` in services/agent.ts
  // and with the frontend's LlmProvider type in rag_agent_client/src/types.ts.
  provider: z.enum(['openai', 'ollama']).optional(),
});
// #endregion

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // #region POST /chat
  app.post('/chat', async (req, reply) => {
    // #region Validate body
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? 'invalid body');
    }
    // #endregion

    // #region Resolve threadId
    // Auto-assign on first turn so callers can treat the returned id as the
    // session handle for follow-ups. Clients must echo it back to continue
    // the conversation — otherwise each request starts a fresh thread.
    const threadId = parsed.data.threadId ?? randomUUID();
    // #endregion

    // #region Run chat pipeline
    try {
      const result = await runChat(
        {
          message: parsed.data.message,
          threadId,
          documentId: parsed.data.documentId,
          // Forward the (already-validated) provider choice. Undefined here
          // means the service layer falls back to its 'openai' default.
          provider: parsed.data.provider,
        },
        app.config,
        req.log,
      );
      return reply.code(200).send(result);
    } catch (err) {
      // Full error always goes to logs. The wire response uses a classified
      // message so the UI can tell the user *why* — e.g. quota vs. rate limit
      // vs. bad key — instead of a generic 500.
      const { status, message, kind } = classifyError(err);
      req.log.error({ err, threadId, kind }, 'chat: failed');
      return reply.code(status).send({ statusCode: status, error: kind, message });
    }
    // #endregion
  });
  // #endregion
};
