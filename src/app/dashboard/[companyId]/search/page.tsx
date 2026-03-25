"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentIcon } from "@/app/components/agent-icons";

const AGENT_ROLES = [
  "Sales", "Marketing", "Accounting", "Strategy", "Product",
  "Front-End Engineering", "Back-End Engineering", "AI Expert",
  "Admin", "HR", "Finance", "Customer Success", "Legal", "Data Analyst", "CEO",
];

interface SearchResult {
  message_id: string;
  conversation_id: string;
  agent_id: string;
  agent_role: string;
  role: string;
  content: string;
  created_at: string;
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  // Truncate to ~300 chars around first match
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex === -1) return text.slice(0, 300);

  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(text.length, matchIndex + query.length + 200);
  let excerpt = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  return excerpt;
}

export default function SearchPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const doSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        companyId,
        q: query.trim(),
        limit: "100",
      });
      if (agentFilter) params.set("agentId", agentFilter);

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }, [companyId, query, agentFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch();
  };

  return (
    <div className="min-h-screen bg-surface pt-8 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/${companyId}`}
            className="text-sm text-neutral-500 hover:text-primary transition-colors mb-2 inline-block"
          >
            &larr; Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-serif)] text-3xl tracking-tight">
                Search Conversations
              </h1>
              <p className="text-sm text-neutral-500">
                Search across all agent conversations
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search messages, topics, tasks..."
                className="w-full pl-10 pr-3 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                autoFocus
              />
            </div>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="px-3 py-2.5 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All agents</option>
              {AGENT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={doSearch}
              disabled={searching || query.trim().length < 2}
              className="px-5 py-2.5 bg-accent text-primary text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Results */}
        {hasSearched && (
          <div>
            <p className="text-sm text-neutral-500 mb-4">
              {total} result{total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </p>

            {results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-400">No messages found matching your search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map(r => (
                  <div key={r.message_id} className="bg-white border border-neutral-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <AgentIcon role={r.agent_role} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.agent_role} Agent</p>
                        <p className="text-xs text-neutral-400">
                          {r.role === "user" ? "You" : "Agent"} &middot; {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.role === "user"
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-secondary/10 text-secondary"
                      }`}>
                        {r.role}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {highlightMatch(r.content, query)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state before search */}
        {!hasSearched && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-serif)] text-xl mb-2">
              Search your agent conversations
            </h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              Find any message across all your agents. Search for topics, keywords, or specific tasks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
