import { Sidebar } from './components/Sidebar';
import { ChatPane } from './components/ChatPane';
import { usePersistedState } from './storage';
import type { ChatMessage, Doc, LlmProvider } from './types';

function App() {
  const { state, setState } = usePersistedState();
  const activeDoc: Doc | null =
    state.docs.find((d) => d.id === state.activeDocId) ?? null;
  const threadKey = state.activeDocId ?? '__none__';
  const messages = state.messagesByDoc[threadKey] ?? [];
  const threadId = state.threadByDoc[threadKey];

  function handleUploaded(doc: Doc) {
    setState((s) => ({
      ...s,
      docs: [doc, ...s.docs.filter((d) => d.id !== doc.id)],
      activeDocId: doc.id,
    }));
  }

  function handleSelect(docId: string | null) {
    setState((s) => ({ ...s, activeDocId: docId }));
  }

  function handleDeleted(docId: string) {
    setState((s) => {
      const threadByDoc = { ...s.threadByDoc };
      const messagesByDoc = { ...s.messagesByDoc };
      delete threadByDoc[docId];
      delete messagesByDoc[docId];
      return {
        ...s,
        docs: s.docs.filter((d) => d.id !== docId),
        activeDocId: s.activeDocId === docId ? null : s.activeDocId,
        threadByDoc,
        messagesByDoc,
      };
    });
  }

  function handleTurn(update: {
    threadId: string;
    userMsg: ChatMessage;
    aiMsg: ChatMessage;
  }) {
    setState((s) => {
      const prior = s.messagesByDoc[threadKey] ?? [];
      return {
        ...s,
        threadByDoc: { ...s.threadByDoc, [threadKey]: update.threadId },
        messagesByDoc: {
          ...s.messagesByDoc,
          [threadKey]: [...prior, update.userMsg, update.aiMsg],
        },
      };
    });
  }

  function handleReset() {
    setState((s) => {
      const threadByDoc = { ...s.threadByDoc };
      const messagesByDoc = { ...s.messagesByDoc };
      delete threadByDoc[threadKey];
      delete messagesByDoc[threadKey];
      return { ...s, threadByDoc, messagesByDoc };
    });
  }

  // LEARNING NOTE
  // Switching the LLM mid-thread is risky: the LangGraph MemorySaver on the
  // server is keyed by `threadId`, so the new model would inherit the
  // conversation produced by the previous one. That's confusing when
  // comparing the two providers, so we drop the current thread on switch —
  // the user starts fresh against the new model. The selection itself is
  // persisted via `setState`, which writes through to localStorage.
  function handleProviderChange(p: LlmProvider) {
    setState((s) => {
      const threadByDoc = { ...s.threadByDoc };
      const messagesByDoc = { ...s.messagesByDoc };
      delete threadByDoc[threadKey];
      delete messagesByDoc[threadKey];
      return { ...s, provider: p, threadByDoc, messagesByDoc };
    });
  }

  return (
    <div className="h-screen flex bg-white text-gray-900">
      <Sidebar
        docs={state.docs}
        activeDocId={state.activeDocId}
        onSelect={handleSelect}
        onUploaded={handleUploaded}
        onDeleted={handleDeleted}
      />
      <ChatPane
        activeDoc={activeDoc}
        threadId={threadId}
        messages={messages}
        onTurn={handleTurn}
        onReset={handleReset}
        provider={state.provider}
        onProviderChange={handleProviderChange}
      />
    </div>
  );
}

export default App;
