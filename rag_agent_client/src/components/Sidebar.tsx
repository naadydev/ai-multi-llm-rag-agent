import { useState } from 'react';
import { deleteDoc, ingestPdf } from '../api';
import type { Doc } from '../types';

interface Props {
  docs: Doc[];
  activeDocId: string | null;
  onSelect: (docId: string | null) => void;
  onUploaded: (doc: Doc) => void;
  onDeleted: (docId: string) => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Sidebar({ docs, activeDocId, onSelect, onUploaded, onDeleted }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete "${doc.filename}"? This removes it from the vector store.`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDoc(doc.id);
      onDeleted(doc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    setUploading(true);
    try {
      const res = await ingestPdf(file);
      onUploaded({
        id: res.documentId,
        filename: res.filename,
        pages: res.pages,
        chunks: res.chunks,
        size: res.size,
        uploadedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">RAG Agent</h1>
        <p className="text-xs text-gray-500 mt-0.5">Chat with your PDFs</p>
      </div>

      <div className="p-4 border-b border-gray-200">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={`block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition ${
            dragOver
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <span>Uploading & indexing…</span>
          ) : (
            <>
              <div className="font-medium text-gray-800">Upload a PDF</div>
              <div className="text-xs text-gray-500 mt-1">Drop here or click to browse</div>
            </>
          )}
        </label>
        {error && (
          <p className="text-xs text-red-600 mt-2 break-words">{error}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Documents
        </div>
        {docs.length === 0 ? (
          <p className="px-2 py-2 text-xs text-gray-500">No documents yet.</p>
        ) : (
          <ul className="space-y-1">
            {docs.map((d) => {
              const active = d.id === activeDocId;
              const deleting = deletingId === d.id;
              return (
                <li key={d.id} className="group relative">
                  <button
                    onClick={() => onSelect(active ? null : d.id)}
                    disabled={deleting}
                    className={`w-full text-left rounded-md pl-3 pr-9 py-2 text-sm transition ${
                      active
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    } ${deleting ? 'opacity-50' : ''}`}
                    title={d.filename}
                  >
                    <div className="truncate font-medium">{d.filename}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {d.pages} pages · {d.chunks} chunks · {fmtSize(d.size)}
                    </div>
                  </button>
                  <button
                    onClick={() => void handleDelete(d)}
                    disabled={deleting}
                    aria-label={`Delete ${d.filename}`}
                    title="Delete"
                    className="absolute top-1/2 -translate-y-1/2 right-1.5 w-7 h-7 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition flex items-center justify-center disabled:opacity-50"
                  >
                    {deleting ? (
                      <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 text-xs text-gray-400">
        {activeDocId ? 'RAG mode' : 'Select a doc to enable RAG'}
      </div>
    </aside>
  );
}
