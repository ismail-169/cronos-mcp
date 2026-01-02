'use client';

import { useState, useEffect, useCallback } from 'react';

interface Payment {
  id: string;
  toolName: string;
  amount: string;
  payer: string;
  txHash: string;
  timestamp: number;
  status: string;
}

interface ServerStats {
  name: string;
  url: string;
  status: 'online' | 'offline' | 'loading';
  network?: string;  // ✅ FIX: Track network per server
  totalRevenue: string;
  transactionCount: number;
  tools: { name: string; price: string; calls: number }[];
  recentPayments: Payment[];
}

interface NetworkConfig {
  network: string;
  chainId: number;
  explorerUrl: string;
}

// Network configurations
const NETWORKS: Record<string, NetworkConfig> = {
  'cronos-testnet': {
    network: 'cronos-testnet',
    chainId: 338,
    explorerUrl: 'https://explorer.cronos.org/testnet',
  },
  'cronos-mainnet': {
    network: 'cronos-mainnet',
    chainId: 25,
    explorerUrl: 'https://explorer.cronos.org',
  },
};

export default function Dashboard() {
  const [servers, setServers] = useState<ServerStats[]>([
    {
      name: 'Market Data Server',
      url: process.env.NEXT_PUBLIC_MARKET_DATA_URL || 'http://localhost:3001',
      status: 'loading',
      totalRevenue: '0',
      transactionCount: 0,
      tools: [],
      recentPayments: [],
    },
    {
      name: 'Onchain Analytics Server',
      url: process.env.NEXT_PUBLIC_ONCHAIN_ANALYTICS_URL || 'http://localhost:3002',
      status: 'loading',
      totalRevenue: '0',
      transactionCount: 0,
      tools: [],
      recentPayments: [],
    },
  ]);

  // ✅ FIX: Track detected network(s) from servers
  const [detectedNetwork, setDetectedNetwork] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchServerStats = useCallback(async (server: ServerStats): Promise<ServerStats> => {
    try {
      const response = await fetch(`${server.url}/stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      
      return {
        ...server,
        status: 'online',
        network: data.network,  // ✅ FIX: Capture network from server response
        totalRevenue: data.totalRevenue || '0',
        transactionCount: data.transactionCount || 0,
        tools: data.tools || [],
        recentPayments: data.recentPayments || [],
      };
    } catch {
      return { ...server, status: 'offline' };
    }
  }, []);

  const refreshData = useCallback(async () => {
    const updatedServers = await Promise.all(servers.map(fetchServerStats));
    setServers(updatedServers);
    setLastUpdated(new Date());

    // ✅ FIX: Detect network from online servers
    const onlineServers = updatedServers.filter(s => s.status === 'online' && s.network);
    if (onlineServers.length > 0) {
      const networks = new Set(onlineServers.map(s => s.network));
      
      if (networks.size > 1) {
        // Multiple networks detected - warn user
        setNetworkMismatch(true);
        console.warn('⚠️ Network mismatch detected:', Array.from(networks));
      } else {
        setNetworkMismatch(false);
      }
      
      // Use the first detected network
      const firstNetwork = onlineServers[0].network!;
      setDetectedNetwork(firstNetwork);
    }
  }, [servers, fetchServerStats]);

  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshData]);

  // ✅ FIX: Get network config dynamically
  const networkConfig = detectedNetwork 
    ? NETWORKS[detectedNetwork] || NETWORKS['cronos-testnet']
    : NETWORKS['cronos-testnet'];

  const totalRevenue = servers.reduce(
    (sum, s) => sum + parseFloat(s.totalRevenue || '0'),
    0
  );
  const totalTransactions = servers.reduce(
    (sum, s) => sum + s.transactionCount,
    0
  );
  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);
  const allPayments = servers
    .flatMap((s) => s.recentPayments)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const formatUSDC = (baseUnits: string) => {
    const usd = parseInt(baseUnits || '0') / 1_000_000;
    return `$${usd.toFixed(6)}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return 'Unknown';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const truncateTxHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
  };

  // ✅ FIX: Get explorer URL based on detected network
  const getExplorerUrl = (txHash: string) => {
    return `${networkConfig.explorerUrl}/tx/${txHash}`;
  };

  return (
    <main className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b-2 border-[#1a1a1a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/cronos_mcp.webp" alt="CronosMCP" className="h-10" />
              <div>
                <h1 className="text-2xl font-bold font-serif">Payment Dashboard</h1>
                <p className="text-gray-500 text-sm">x402 Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* ✅ FIX: Network indicator with mismatch warning */}
              <div className={`flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#1a1a1a] rounded-lg ${
                networkMismatch 
                  ? 'shadow-[3px_3px_0_#ef4444]' 
                  : detectedNetwork === 'cronos-mainnet'
                    ? 'shadow-[3px_3px_0_#22c55e]'
                    : 'shadow-[3px_3px_0_#f59e0b]'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  networkMismatch 
                    ? 'bg-red-500 animate-pulse'
                    : detectedNetwork === 'cronos-mainnet' 
                      ? 'bg-green-500' 
                      : 'bg-amber-500'
                }`} />
                <span className="text-sm font-medium">
                  {networkMismatch 
                    ? '⚠️ Mixed Networks!'
                    : detectedNetwork === 'cronos-mainnet' 
                      ? 'Mainnet' 
                      : 'Testnet'
                  }
                </span>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 border-[#1a1a1a] transition-all duration-150 ${
                  autoRefresh
                    ? 'bg-[#22d3ee] shadow-[3px_3px_0_#1a1a1a] hover:shadow-[5px_5px_0_#1a1a1a] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                    : 'bg-white shadow-[3px_3px_0_#e5e5e5]'
                }`}
              >
                {autoRefresh ? '● Live' : '○ Paused'}
              </button>
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-white border-2 border-[#1a1a1a] rounded-lg text-sm font-semibold shadow-[3px_3px_0_#8B5CF6] transition-all duration-150 hover:shadow-[5px_5px_0_#8B5CF6] hover:translate-x-[-2px] hover:translate-y-[-2px]"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Network Mismatch Warning */}
        {networkMismatch && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-xl shadow-[4px_4px_0_#ef4444]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-700">Network Mismatch Detected</p>
                <p className="text-sm text-red-600">
                  Your servers are running on different networks. This may cause payment issues.
                  {servers.filter(s => s.status === 'online').map(s => (
                    <span key={s.url} className="ml-2 px-2 py-0.5 bg-red-100 rounded text-xs">
                      {s.name}: {s.network}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#22d3ee] transition-all duration-150 hover:shadow-[8px_8px_0_#22d3ee] hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">Total Revenue</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-bold font-serif">
              ${(totalRevenue / 1_000_000).toFixed(4)}
            </p>
            <p className="text-gray-400 text-xs mt-1">USDC earned</p>
          </div>

          <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#22c55e] transition-all duration-150 hover:shadow-[8px_8px_0_#22c55e] hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">Transactions</span>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-3xl font-bold font-serif">{totalTransactions}</p>
            <p className="text-gray-400 text-xs mt-1">Payments settled</p>
          </div>

          <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#8B5CF6] transition-all duration-150 hover:shadow-[8px_8px_0_#8B5CF6] hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">Active Tools</span>
              <span className="text-2xl">🔧</span>
            </div>
            <p className="text-3xl font-bold font-serif">{totalTools}</p>
            <p className="text-gray-400 text-xs mt-1">Paid endpoints</p>
          </div>

          <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#f59e0b] transition-all duration-150 hover:shadow-[8px_8px_0_#f59e0b] hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">Servers</span>
              <span className="text-2xl">🖥️</span>
            </div>
            <p className="text-3xl font-bold font-serif">
              {servers.filter((s) => s.status === 'online').length}/{servers.length}
            </p>
            <p className="text-gray-400 text-xs mt-1">Online</p>
          </div>
        </div>

        {/* Server Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {servers.map((server, idx) => (
            <div
              key={idx}
              className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#22d3ee] transition-all duration-150 hover:shadow-[8px_8px_0_#22d3ee] hover:translate-x-[-2px] hover:translate-y-[-2px]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{server.name}</h3>
                  {/* ✅ FIX: Show network badge per server */}
                  {server.network && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      server.network === 'cronos-mainnet'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {server.network === 'cronos-mainnet' ? 'Mainnet' : 'Testnet'}
                    </span>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 ${
                    server.status === 'online'
                      ? 'bg-green-100 text-green-700 border-green-500'
                      : server.status === 'loading'
                      ? 'bg-amber-100 text-amber-700 border-amber-500'
                      : 'bg-red-100 text-red-700 border-red-500'
                  }`}
                >
                  {server.status === 'online' ? '● Online' : server.status === 'loading' ? '◌ Loading' : '○ Offline'}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4 font-mono">{server.url}</p>

              {server.status === 'online' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-[#fafafa] border-2 border-[#e5e5e5] rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Revenue</p>
                      <p className="font-semibold">{formatUSDC(server.totalRevenue)}</p>
                    </div>
                    <div className="bg-[#fafafa] border-2 border-[#e5e5e5] rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Transactions</p>
                      <p className="font-semibold">{server.transactionCount}</p>
                    </div>
                  </div>

                  {server.tools.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Tools</p>
                      <div className="space-y-2">
                        {server.tools.map((tool, toolIdx) => (
                          <div
                            key={toolIdx}
                            className="flex items-center justify-between bg-[#fafafa] border-2 border-[#e5e5e5] rounded-lg px-3 py-2"
                          >
                            <span className="text-sm">{tool.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[#22d3ee] text-sm font-medium">{formatUSDC(tool.price)}</span>
                              <span className="text-gray-400 text-xs">{tool.calls} calls</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Recent Payments */}
        <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-6 shadow-[6px_6px_0_#8B5CF6]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold font-serif">Recent Payments</h2>
            {lastUpdated && (
              <span className="text-gray-400 text-sm">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {allPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b-2 border-[#e5e5e5]">
                    <th className="pb-3 text-gray-500 text-sm font-medium">Time</th>
                    <th className="pb-3 text-gray-500 text-sm font-medium">Tool</th>
                    <th className="pb-3 text-gray-500 text-sm font-medium">Amount</th>
                    <th className="pb-3 text-gray-500 text-sm font-medium">Payer</th>
                    <th className="pb-3 text-gray-500 text-sm font-medium">Transaction</th>
                    <th className="pb-3 text-gray-500 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allPayments.map((payment, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-sm">
                        {formatTime(payment.timestamp)}
                      </td>
                      <td className="py-3">
                        <span className="text-sm font-medium">
                          {payment.toolName}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-[#22d3ee] text-sm font-semibold">
                          {formatUSDC(payment.amount)}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-gray-500 text-sm font-mono">
                          {truncateAddress(payment.payer)}
                        </span>
                      </td>
                      <td className="py-3">
                        {payment.txHash ? (
                          <a
                            href={getExplorerUrl(payment.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#8B5CF6] hover:underline text-sm font-mono"
                          >
                            {truncateTxHash(payment.txHash)} ↗
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 border border-green-500 rounded-lg text-xs font-medium">
                          {payment.status || 'settled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-gray-500">No payments recorded yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Run the demo agent to see payments appear here
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Powered by{' '}
            <a
              href="https://cronos.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8B5CF6] hover:underline"
            >
              Cronos x402
            </a>
            {' | '}
            <span className="font-mono text-xs">
              Explorer: {networkConfig.explorerUrl}
            </span>
          </p>
        </footer>
      </div>
    </main>
  );
}