'use client';

import { useState, useEffect, useRef } from 'react';
import { SearchResult } from '@/app/lib/types';
import { agents } from '@/app/lib/agents';

interface Props {
  password: string;
  onClose: () => void;
  onNavigate: (agentId: string, conversationId: number) => void;
}

export default function SearchOverlay({ password, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&password=${encodeURIComponent(password)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, password]);

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search across all agents and conversations..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
        <div className="search-results">
          {loading && (
            <div className="search-no-results">Searching...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="search-no-results">No results found</div>
          )}
          {!loading && results.map(r => (
            <div
              key={r.messageId}
              className="search-result-item"
              onClick={() => {
                onNavigate(r.agentId, r.conversationId);
                onClose();
              }}
            >
              <div className="search-result-meta">
                <span>{agentMap[r.agentId]?.icon || '?'}</span>
                <span style={{ fontWeight: 600 }}>{r.agentName}</span>
                <span>{'>'}</span>
                <span>{r.conversationTitle}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {r.role === 'user' ? r.userName || 'User' : r.agentName}
                </span>
              </div>
              <div className="search-result-content">
                {r.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
