// Thin fetch wrapper around the RAG server's REST API. Keeps all network
// concerns (base URL, error shape, JSON parsing) out of React components.

import type { ChatResponse, IngestResponse, LlmProvider } from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3002';

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message ?? body?.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function ingestPdf(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/v1/ingest`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteDoc(documentId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}

export async function sendChat(params: {
  message: string;
  threadId?: string;
  documentId?: string;
  // LEARNING NOTE
  // Optional. When omitted the server falls back to its 'openai' default,
  // so the UI works even before the model picker is wired up. We just
  // splat `params` into the JSON body — no extra mapping needed.
  provider?: LlmProvider;
}): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/v1/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
