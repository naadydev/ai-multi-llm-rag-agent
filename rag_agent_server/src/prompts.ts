// #region Overview
// Prompt templates kept separate from the agent wiring so they can be
// reviewed, tweaked, and diffed as their own artifact. If we later want
// to experiment with multiple prompts (A/B, per-feature), this is the
// place that grows — not agent.ts.
// #endregion

// #region Chat agent
// The system prompt that shapes the assistant's behavior. Emphasizes:
//   - preferring retrieval over guessing when a tool is available
//   - citing page numbers so answers are traceable back to the source
//   - admitting empty retrievals instead of hallucinating
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant.
When the user asks about a document and a retrieval tool is available, call it before answering.
Always cite page numbers from tool results when you use them. If the tool returns nothing relevant, say so honestly instead of guessing.`;
// #endregion
