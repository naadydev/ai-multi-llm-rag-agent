// localStorage-backed hook for app state that should survive page reload:
// the list of uploaded docs, which one is active, the thread id per doc,
// and per-doc message history.
//
// Kept deliberately simple (one JSON blob per key) — swap for IndexedDB if
// histories ever get long enough to hurt sync storage.

import { useEffect, useState } from 'react';
import type { ChatMessage, Doc, LlmProvider } from './types';

const KEY = 'rag_agent_client_v1';

interface Persisted {
  docs: Doc[];
  activeDocId: string | null;
  threadByDoc: Record<string, string>;          // docId → threadId
  messagesByDoc: Record<string, ChatMessage[]>; // docId → messages
  // LEARNING NOTE
  // The selected chat-LLM provider. Persisted so the user's choice survives
  // a page reload. Default 'openai' keeps the historical behavior for any
  // user who has an old localStorage blob from before this field existed
  // (the `{ ...empty, ...JSON.parse(raw) }` merge in `load()` fills it in).
  provider: LlmProvider;
}

const empty: Persisted = {
  docs: [],
  activeDocId: null,
  threadByDoc: {},
  messagesByDoc: {},
  provider: 'openai',
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function usePersistedState() {
  const [state, setState] = useState<Persisted>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  return { state, setState };
}
