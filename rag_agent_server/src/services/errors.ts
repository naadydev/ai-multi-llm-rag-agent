// #region Overview
// Classifies errors from upstream providers (OpenAI, Pinecone) into a small
// set of user-facing shapes. Route handlers use this to pick the right HTTP
// status + message so the client can show something more useful than a
// generic "failed" — e.g. "LLM quota exceeded" vs. "rate limited" vs.
// "invalid API key".
// #endregion

export type ErrorKind =
  | 'quota_exceeded'   // Billing / hard cap hit — retry won't help
  | 'rate_limited'     // Soft rate limit — retry after a moment
  | 'auth'             // Bad / missing API key
  | 'unknown';

export interface ClassifiedError {
  kind: ErrorKind;
  status: number;      // HTTP status to return to the client
  message: string;     // Safe, user-facing message
}

// LangChain/OpenAI errors carry the HTTP status as `.status` and a named
// class for quota vs. rate-limit. We inspect both plus the message text
// because different SDK versions surface different fields.
export function classifyError(err: unknown): ClassifiedError {
  const anyErr = err as { name?: string; status?: number; message?: string } | null;
  const name = anyErr?.name ?? '';
  const status = anyErr?.status ?? 0;
  const msg = anyErr?.message ?? '';

  if (name === 'InsufficientQuotaError' || /exceeded your current quota/i.test(msg)) {
    return {
      kind: 'quota_exceeded',
      status: 429,
      message: 'LLM quota exceeded — check your OpenAI billing / plan.',
    };
  }
  if (status === 429 || /rate limit/i.test(msg)) {
    return {
      kind: 'rate_limited',
      status: 429,
      message: 'LLM is rate-limited — please retry in a moment.',
    };
  }
  if (status === 401 || /invalid api key|incorrect api key/i.test(msg)) {
    return {
      kind: 'auth',
      status: 401,
      message: 'LLM provider rejected the API key.',
    };
  }
  return { kind: 'unknown', status: 500, message: 'chat failed' };
}
