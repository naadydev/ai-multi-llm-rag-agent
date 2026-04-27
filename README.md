# AI Multi-LLM RAG Agent

A full-stack **Retrieval-Augmented Generation (RAG)** application that lets you upload PDFs and chat with them. Answers are grounded in the document and cite specific page numbers, so every response is traceable back to the source.

Built as a hands-on learning project to explore modern AI-agent tooling end to end — from PDF ingestion and vector storage, to a ReAct agent with tool calling, to a streaming-ready React chat UI.

---

## Highlights

- **Two LLM providers, one agent** — swap between **OpenAI** (hosted) and **Ollama** (local) per request without touching the agent code. Demonstrates a clean provider abstraction over `BaseChatModel`.
- **LangGraph ReAct agent** with tool use, system prompts, and thread-scoped conversational memory (`MemorySaver` keyed by `thread_id`).
- **Per-document Pinecone namespaces** — every uploaded PDF gets its own isolated vector space; the retriever tool is bound to that namespace at agent-build time.
- **PDF ingestion pipeline** with MIME and magic-byte validation, chunking (`RecursiveCharacterTextSplitter`), and batched upserts.
- **Cited answers** — the system prompt requires the agent to surface page numbers from retrieved chunks, or admit it doesn't know.
- **LangSmith tracing** wired implicitly via env vars — every run/turn is grouped by thread for easy debugging.
- **Versioned REST API** (`/api/v1`) on Fastify with Zod validation, multipart upload limits, and CORS.
- **Modern frontend** — React 19 + Vite + Tailwind 4 with a sidebar (document list) and chat pane.

---

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────────────┐
│  React 19 + Vite client  │  HTTP   │       Fastify API (Node/TS)      │
│  (Tailwind 4)            │ ──────► │  /api/v1/ingest                  │
│  - Sidebar (documents)   │         │  /api/v1/chat                    │
│  - ChatPane              │         │  /api/v1/documents/:id           │
└──────────────────────────┘         └──────────────────────────────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                       ┌────────────┐      ┌──────────────┐     ┌──────────────┐
                       │ Pinecone   │      │  LangGraph   │     │  LLM         │
                       │ (vectors,  │◄────►│  ReAct agent │────►│  OpenAI  OR  │
                       │ per-doc    │      │  + retriever │     │  Ollama      │
                       │ namespace) │      │  tool        │     │  (local)     │
                       └────────────┘      └──────────────┘     └──────────────┘
                              ▲                    │
                              │                    ▼
                       ┌────────────┐      ┌──────────────┐
                       │  PDF       │      │  LangSmith   │
                       │ ingestion  │      │  tracing     │
                       │ (chunk +   │      │  (optional)  │
                       │  embed)    │      └──────────────┘
                       └────────────┘
```

### Request flow — chat turn

1. Client `POST /api/v1/chat` with `{ documentId, threadId, provider, message }`.
2. Server builds a fresh `ReAct` agent: LLM (OpenAI or Ollama), system prompt, retriever tool bound to the document's Pinecone namespace, shared `MemorySaver` checkpointer.
3. Agent decides whether to call the retriever; retrieved chunks (with page metadata) flow back into the LLM context.
4. LLM produces a cited answer; turn is checkpointed under `thread_id` so follow-ups have history.

---

## Tech stack

**Backend** (`rag_agent_server/`)
- Node.js 20+, TypeScript, **Fastify 5**
- **LangChain 1.x**, **LangGraph 1.x** (`createAgent`, `MemorySaver`)
- **Pinecone** (`@langchain/pinecone`) for vector storage
- **OpenAI** (`@langchain/openai`) and **Ollama** (`@langchain/ollama`) chat models
- `pdf-parse` / `pdfjs-dist` for PDF text extraction
- **Zod** for runtime validation, **Vitest** for tests
- **LangSmith** for tracing (optional)

**Frontend** (`rag_agent_client/`)
- **React 19**, **Vite 8**, **TypeScript**
- **Tailwind CSS 4**

---

## Getting started

### Prerequisites
- Node.js ≥ 20
- A **Pinecone** account + index
- An **OpenAI** API key, **and/or** a local **Ollama** install (`ollama serve` + `ollama pull <model>`)

### 1. Server

```bash
cd rag_agent_server
npm install --legacy-peer-deps
cp .env.example .env
# fill in OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX (and optionally LANGSMITH_*)
npm run dev
```

The API listens on `http://localhost:3000` (or whatever `PORT` you set).

> **Note on `--legacy-peer-deps`**: required because `@langchain/community` transitively pins an older `zod`. See [rag_agent_server/README.md](rag_agent_server/README.md) for details.

### 2. Client

```bash
cd rag_agent_client
npm install
cp .env.example .env
# set VITE_API_BASE_URL=http://localhost:3000
npm run dev
```

---

## API surface

| Method | Path                       | Purpose                                                  |
| ------ | -------------------------- | -------------------------------------------------------- |
| GET    | `/health`                  | Liveness probe                                           |
| POST   | `/api/v1/ingest`           | Upload a PDF; returns a `documentId`                     |
| POST   | `/api/v1/chat`             | Send a message; agent retrieves + answers with citations |
| DELETE | `/api/v1/documents/:id`    | Remove a document and its vectors                        |

---

## What I learned building this

- How a **ReAct agent** decides when to call a tool vs. answer directly, and why the system prompt matters as much as the model.
- How **LangGraph checkpointers** turn stateless LLM calls into a real conversation — and the trade-offs of `MemorySaver` (in-process) vs a Postgres/Redis-backed saver for production.
- Why **per-document namespaces** in Pinecone are simpler than metadata-filtered shared indexes when scoping retrieval to a single source.
- How **LangSmith** integrates implicitly via env vars and `thread_id` — no tracer code in the app.
- The pragmatics of **multi-provider LLM support**: a thin abstraction at the model-construction step is enough; everything downstream (tools, prompt, memory) stays identical.
- Operational details: Fastify plugin order (`env` before everything that reads `app.config`), `multipart` upload limits, CORS for non-GET methods, magic-byte validation for uploaded files.

---

## Roadmap / ideas

- [ ] Streaming responses (SSE + `agent.stream()`)
- [ ] Postgres-backed checkpointer for persistent memory
- [ ] Cross-document retrieval via shared namespace + metadata filters
- [ ] Auth + per-user document isolation
- [ ] Anthropic provider alongside OpenAI/Ollama
- [ ] Source-chunk preview in the UI (click a citation → see the page)

---

## License

MIT — built for learning, free to fork and learn from.
