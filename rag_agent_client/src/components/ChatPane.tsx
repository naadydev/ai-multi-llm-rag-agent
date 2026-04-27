import { useEffect, useRef, useState } from 'react';
import { sendChat } from '../api';
import type { ChatMessage, Doc, LlmProvider } from '../types';

interface Props {
  activeDoc: Doc | null;
  threadId: string | undefined;
  messages: ChatMessage[];
  onTurn: (update: { threadId: string; userMsg: ChatMessage; aiMsg: ChatMessage }) => void;
  onReset: () => void;
  // LEARNING NOTE
  // The provider selection lives in App-level persisted state (see App.tsx
  // and storage.ts) — this pane is "dumb" and just renders + reports
  // changes. That keeps the two responsibilities clean: App owns *state*,
  // ChatPane owns *UI*.
  provider: LlmProvider;
  onProviderChange: (p: LlmProvider) => void;
}

export function ChatPane({
  activeDoc,
  threadId,
  messages,
  onTurn,
  onReset,
  provider,
  onProviderChange,
}: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      at: Date.now(),
    };
    setInput('');
    try {
      const res = await sendChat({
        message: text,
        threadId,
        documentId: activeDoc?.id,
        // Forward the user's current model selection. The server will fall
        // back to OpenAI if this is ever omitted, so it's safe to send.
        provider,
      });
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.message,
        at: Date.now(),
      };
      onTurn({ threadId: res.threadId, userMsg, aiMsg });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex-1 flex flex-col bg-white min-w-0">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {activeDoc ? activeDoc.filename : 'General chat'}
          </h2>
          <p className="text-xs text-gray-500">
            {activeDoc
              ? `Answering from ${activeDoc.pages} pages · ${activeDoc.chunks} chunks`
              : 'No document selected — LLM knowledge only'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/*
            LEARNING NOTE — model picker.
            Disabled while a request is in flight so the user can't change
            providers mid-roundtrip. Switching providers also clears the
            current thread (see App.tsx#handleProviderChange) because the
            server-side conversation memory is keyed by threadId — letting
            the new model inherit the old transcript would muddy any
            comparison between the two.
          */}
          <label className="text-xs text-gray-500" htmlFor="provider-select">
            Model:
          </label>
          <select
            id="provider-select"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
            disabled={sending}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="openai">OpenAI · gpt-4o-mini</option>
            <option value="ollama">Ollama · qwen3.5:2b (local)</option>
          </select>
          {messages.length > 0 && (
            <button
              onClick={onReset}
              className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            >
              New thread
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !sending && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">
              {activeDoc
                ? 'Ask anything about this document.'
                : 'Upload a PDF from the sidebar to start a grounded chat.'}
            </p>
          </div>
        )}

        <ul className="space-y-4 max-w-3xl mx-auto">
          {messages.map((m) => (
            <li key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </li>
          ))}
          {sending && (
            <li className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 text-gray-500 px-4 py-2.5 text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                </span>
              </div>
            </li>
          )}
        </ul>
      </div>

      <div className="border-t border-gray-200 px-6 py-4">
        {error && (
          <p className="text-xs text-red-600 mb-2 max-w-3xl mx-auto">{error}</p>
        )}
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder={activeDoc ? 'Ask about the document…' : 'Send a message…'}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-h-40"
            disabled={sending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </section>
  );
}
