'use client';

import { useState } from 'react';

interface SearchResult {
  summary: string;
  data: Record<string, unknown>;
  sources: string[];
  cost: string;
  timestamp: number;
}

export function AgentSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error('Search failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white neo-border neo-shadow-cyan rounded-neo p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🤖</span>
          <h2 className="text-2xl font-serif font-bold">AgentQuery</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Natural language search across all x402 data sources
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What's CRO price? Compare ETH vs BTC volume..."
            className="flex-1 px-4 py-3 neo-border rounded-neo focus:outline-none focus:neo-shadow-purple transition-all"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-neo-cyan neo-border rounded-neo font-semibold neo-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳' : '🔍'}
          </button>
        </div>

        <div className="flex gap-2 mt-3 text-sm text-gray-500">
          <span>Try:</span>
          <button
            onClick={() => setQuery("What's CRO price?")}
            className="text-neo-purple hover:underline"
          >
            CRO price
          </button>
          <span>•</span>
          <button
            onClick={() => setQuery("Compare BTC and ETH volume")}
            className="text-neo-purple hover:underline"
          >
            Compare tokens
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white neo-border neo-shadow-amber rounded-neo p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-neo-amber border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Querying data sources...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 neo-border border-red-500 rounded-neo p-6">
          <h3 className="font-bold text-red-700 mb-2">❌ Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 fade-in">
          <div className="bg-white neo-border neo-shadow-green rounded-neo p-6">
            <h3 className="font-serif font-bold text-lg mb-3">✅ Answer</h3>
            <p className="text-gray-800 leading-relaxed">{result.summary}</p>
          </div>

          {Object.keys(result.data).length > 0 && (
            <div className="bg-white neo-border neo-shadow-purple rounded-neo p-6">
              <h3 className="font-serif font-bold text-lg mb-3">📊 Data</h3>
              <pre className="bg-neo-light p-4 rounded-neo overflow-x-auto text-sm">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex gap-4">
              <span>💰 Cost: ${(parseInt(result.cost) / 1_000_000).toFixed(6)} USDC</span>
              <span>🔗 Sources: {result.sources.length}</span>
            </div>
            <span className="text-xs">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}