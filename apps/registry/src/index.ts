import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ToolDefinition {
  name: string;
  description: string;
  price: string;
  inputSchema?: Record<string, unknown>;
}

interface RegisteredServer {
  id: string;
  projectName: string;
  name: string;
  description: string;
  version: string;
  endpoint: string;
  network: 'cronos-mainnet' | 'cronos-testnet';
  paymentAddress: string;
  ownerAddress: string;
  tools: ToolDefinition[];
  registeredAt: string;
  lastSeenAt: string;
  status: 'active' | 'inactive' | 'unknown';
  stats: {
    totalCalls: number;
    totalRevenue: string;
    uptime: number;
  };
}

interface RegistryStats {
  totalProjects: number;
  totalServers: number;
  totalTools: number;
  activeServers: number;
  networks: {
    mainnet: number;
    testnet: number;
  };
}

interface GrokResponse {
  choices: Array<{ message: { content: string } }>;
}

const servers: Map<string, RegisteredServer> = new Map();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStaticFile(res: http.ServerResponse, filePath: string): boolean {
  const publicDir = path.join(__dirname, '../public');
  const fullPath = path.join(publicDir, filePath);
  
  if (!fullPath.startsWith(publicDir)) {
    return false;
  }

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(fullPath);
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
      return true;
    }
  } catch (e) {
  }
  return false;
}

function serveHTMLPage(res: http.ServerResponse, fileName: string): void {
  const publicDir = path.join(__dirname, '../public');
  const filePath = path.join(publicDir, fileName);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - Page Not Found</h1>');
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>500 - Internal Server Error</h1>');
  }
}

function generateId(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    const char = endpoint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

async function fetchServerInfo(endpoint: string): Promise<{
  info?: { name: string; version: string; description: string; network: string; paymentAddress?: string };
  tools?: { tools: ToolDefinition[] };
}> {
  const results: {
    info?: { name: string; version: string; description: string; network: string; paymentAddress?: string };
    tools?: { tools: ToolDefinition[] };
  } = {};

  try {
    const infoRes = await fetch(`${endpoint}/info`);
    if (infoRes.ok) {
      results.info = await infoRes.json();
    }
  } catch (e) {
  }

  try {
    const toolsRes = await fetch(`${endpoint}/tools`);
    if (toolsRes.ok) {
      results.tools = await toolsRes.json();
    }
  } catch (e) {
  }

  return results;
}

async function callGrokAI(prompt: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error('GROK_API_KEY not configured');
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json() as GrokResponse;
  return data.choices[0].message.content;
}

async function discoverTools(): Promise<Record<string, ToolDefinition[]>> {
  const tools: Record<string, ToolDefinition[]> = {};
  
  for (const [name, server] of servers.entries()) {
    tools[name] = server.tools || [];
  }
  
  tools['registry'] = [
    {
      name: 'search_tools',
      description: 'Search for x402 tools by keyword. Use this when users ask what tools are available, what x402 services exist, or to find tools for specific purposes like DeFi, market data, NFTs, etc.',
      price: '0',
      inputSchema: { q: 'string (search query)', network: 'string (optional: cronos-mainnet or cronos-testnet)', maxPrice: 'string (optional: max price in USDC atomic units)' }
    },
    {
      name: 'list_servers',
      description: 'List all registered x402 MCP servers. Use this to show all available servers/projects in the registry.',
      price: '0',
      inputSchema: { network: 'string (optional: cronos-mainnet or cronos-testnet)', status: 'string (optional: active, inactive, unknown)' }
    },
    {
      name: 'list_projects',
      description: 'List all x402 projects grouped by name. Use this to show available projects and their tools.',
      price: '0',
      inputSchema: { network: 'string (optional: cronos-mainnet or cronos-testnet)' }
    },
    {
      name: 'get_stats',
      description: 'Get registry statistics including total projects, servers, tools count.',
      price: '0',
      inputSchema: {}
    }
  ];
  
  const marketDataUrl = process.env.MARKET_DATA_URL || 'http://localhost:3001';
  const onchainUrl = process.env.ONCHAIN_URL || 'http://localhost:3002';
  
  try {
    const res = await fetch(`${marketDataUrl}/tools`);
    if (res.ok) {
      const data = await res.json() as { tools?: ToolDefinition[] };
      tools['market-data'] = data.tools || [];
    }
  } catch (e) {}
  
  try {
    const res = await fetch(`${onchainUrl}/tools`);
    if (res.ok) {
      const data = await res.json() as { tools?: ToolDefinition[] };
      tools['onchain-analytics'] = data.tools || [];
    }
  } catch (e) {}
  
  return tools;
}

async function executeToolCall(serverName: string, toolName: string, params: Record<string, unknown>): Promise<unknown> {
  if (serverName === 'registry') {
    return executeRegistryTool(toolName, params);
  }
  
  let baseUrl = '';
  
  if (serverName === 'market-data') {
    baseUrl = process.env.MARKET_DATA_URL || 'http://localhost:3001';
  } else if (serverName === 'onchain-analytics') {
    baseUrl = process.env.ONCHAIN_URL || 'http://localhost:3002';
  } else {
    const server = servers.get(serverName);
    if (server) {
      baseUrl = server.endpoint;
    }
  }
  
  if (!baseUrl) {
    return { error: `Server ${serverName} not found` };
  }
  
  try {
    const response = await fetch(`${baseUrl}/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (e) {
    return { error: String(e) };
  }
}

function executeRegistryTool(toolName: string, params: Record<string, unknown>): unknown {
  const allServers = Array.from(servers.values());
  
  if (toolName === 'search_tools') {
    const query = (params.q as string || '').toLowerCase();
    const network = params.network as string;
    const maxPrice = params.maxPrice as string;
    
    const results: Array<{
      server: { id: string; name: string; projectName: string; endpoint: string; network: string };
      tool: ToolDefinition;
    }> = [];

    for (const server of allServers) {
      if (network && server.network !== network) continue;

      for (const tool of server.tools) {
        const matchesQuery = !query || 
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query);
        const matchesPrice = !maxPrice || BigInt(tool.price) <= BigInt(maxPrice);

        if (matchesQuery && matchesPrice) {
          results.push({
            server: {
              id: server.id,
              name: server.name,
              projectName: server.projectName,
              endpoint: server.endpoint,
              network: server.network,
            },
            tool,
          });
        }
      }
    }
    return { count: results.length, results };
  }
  
  if (toolName === 'list_servers') {
    const network = params.network as string;
    const status = params.status as string;
    
    let results = allServers;
    if (network) results = results.filter(s => s.network === network);
    if (status) results = results.filter(s => s.status === status);
    
    const publicResults = results.map(({ ownerAddress, ...rest }) => rest);
    return { count: publicResults.length, servers: publicResults };
  }
  
  if (toolName === 'list_projects') {
    const network = params.network as string;
    const filteredServers = network ? allServers.filter(s => s.network === network) : allServers;
    
    const projectMap = new Map<string, { name: string; serverCount: number; totalTools: number; tools: string[] }>();
    
    for (const server of filteredServers) {
      const projectName = server.projectName || 'Unnamed Project';
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, { name: projectName, serverCount: 0, totalTools: 0, tools: [] });
      }
      const project = projectMap.get(projectName)!;
      project.serverCount++;
      project.totalTools += server.tools.length;
      project.tools.push(...server.tools.map(t => t.name));
    }
    
    return { count: projectMap.size, projects: Array.from(projectMap.values()) };
  }
  
  if (toolName === 'get_stats') {
    const projects = new Set(allServers.map(s => s.projectName));
    return {
      totalProjects: projects.size,
      totalServers: allServers.length,
      totalTools: allServers.reduce((sum, s) => sum + s.tools.length, 0),
      activeServers: allServers.filter(s => s.status === 'active').length,
      networks: {
        mainnet: allServers.filter(s => s.network === 'cronos-mainnet').length,
        testnet: allServers.filter(s => s.network === 'cronos-testnet').length,
      },
    };
  }
  
  return { error: `Unknown registry tool: ${toolName}` };
}

function extractJSON(response: string): unknown {
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                   response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }
  return JSON.parse(response);
}

async function handleAISearch(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!process.env.GROK_API_KEY) {
    sendJSON(res, 503, { error: 'AI search not configured. Set GROK_API_KEY environment variable.' });
    return;
  }

  try {
    const body = await parseBody(req) as { query?: string };
    const query = body.query;
    
    if (!query || typeof query !== 'string') {
      sendJSON(res, 400, { error: 'Query required' });
      return;
    }

    const tools = await discoverTools();
    const serverList = [
      { name: 'registry', url: 'local', description: 'x402 Tool Registry - search for available tools, list servers, list projects, get stats. Use this when users ask what tools exist, what x402 services are available, or want to discover tools.' },
      { name: 'market-data', url: process.env.MARKET_DATA_URL || 'http://localhost:3001', description: 'Crypto.com Exchange market data - get prices, tickers, orderbook, trades' },
      { name: 'onchain-analytics', url: process.env.ONCHAIN_URL || 'http://localhost:3002', description: 'Cronos blockchain analytics - wallet balances, transactions, token info' },
    ];

    const planPrompt = `You are an AI assistant for x402 protocol on Cronos blockchain.

Available servers: ${JSON.stringify(serverList)}
Available tools: ${JSON.stringify(tools)}

User query: "${query}"

IMPORTANT:
- If user asks about available tools, what x402 offers, or wants to discover services, use the "registry" server with search_tools, list_servers, list_projects, or get_stats
- If user asks about crypto prices, market data, use "market-data" server
- If user asks about blockchain data, wallets, transactions, use "onchain-analytics" server

Return only JSON (no markdown):
{"reasoning": "brief explanation of which tools to call", "calls": [{"server": "name", "tool": "name", "params": {}}]}`;

    const planResponse = await callGrokAI(planPrompt);
    const plan = extractJSON(planResponse) as { calls: Array<{ server: string; tool: string; params: Record<string, unknown> }> };

    const results = await Promise.all(
      plan.calls.map(async (call) => {
        const result = await executeToolCall(call.server, call.tool, call.params);
        return {
          source: `${call.server}/${call.tool}`,
          result,
        };
      })
    );

    const synthesizePrompt = `User: "${query}"
Results: ${JSON.stringify(results)}

Return only JSON (no markdown):
{"summary": "2-3 sentence answer", "data": {}}`;

    const synthesisResponse = await callGrokAI(synthesizePrompt);
    const synthesis = extractJSON(synthesisResponse) as { summary: string; data: Record<string, unknown> };

    sendJSON(res, 200, {
      summary: synthesis.summary,
      data: synthesis.data,
      sources: results.map(r => r.source),
      cost: '0',
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('[AI Search]', error);
    sendJSON(res, 500, { error: error instanceof Error ? error.message : 'Search failed' });
  }
}

function serveSearchPage(res: http.ServerResponse): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentQuery - CronosMCP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .card {
      background: white;
      border: 3px solid #1a1a1a;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 8px 8px 0 rgba(0,0,0,0.2);
    }
    .card-cyan { box-shadow: 8px 8px 0 #22d3ee; }
    .card-green { box-shadow: 8px 8px 0 #22c55e; }
    .card-purple { box-shadow: 8px 8px 0 #8B5CF6; }
    .card-amber { box-shadow: 8px 8px 0 #f59e0b; }
    .card-red { box-shadow: 8px 8px 0 #ef4444; background: #fef2f2; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .emoji { font-size: 40px; }
    .title { font-size: 28px; font-weight: 700; color: #1a1a1a; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 16px; }
    .search-box { display: flex; gap: 12px; }
    .search-input {
      flex: 1;
      padding: 16px 20px;
      font-size: 16px;
      border: 3px solid #1a1a1a;
      border-radius: 12px;
      outline: none;
      transition: box-shadow 0.2s;
    }
    .search-input:focus { box-shadow: 4px 4px 0 #8B5CF6; }
    .search-btn {
      padding: 16px 28px;
      font-size: 20px;
      background: #22d3ee;
      border: 3px solid #1a1a1a;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .search-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #1a1a1a; }
    .search-btn:active { transform: translate(0, 0); box-shadow: 2px 2px 0 #1a1a1a; }
    .try-section { margin-top: 16px; font-size: 14px; color: #666; }
    .try-btn { 
      background: none; border: none; color: #8B5CF6; 
      cursor: pointer; text-decoration: underline; font-size: 14px;
    }
    .try-btn:hover { color: #6d28d9; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
    .answer-text { color: #333; line-height: 1.7; font-size: 16px; }
    .data-pre {
      background: #f3f4f6;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
      border: 2px solid #e5e7eb;
    }
    .meta { display: flex; gap: 24px; font-size: 14px; color: #666; margin-top: 16px; }
    .loading-spinner {
      width: 40px; height: 40px;
      border: 4px solid #f59e0b;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { color: #666; }
    .error-title { color: #dc2626; font-weight: 700; margin-bottom: 8px; }
    .error-text { color: #b91c1c; }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; } }
  </style>
</head>
<body>
  <div class="container" id="root"></div>
  <script>
    const root = document.getElementById('root');
    let query = '', loading = false, result = null, error = null;
    
    function render() {
      root.innerHTML = \`
        <div class="card card-cyan">
          <div class="header">
            <span class="emoji">🤖</span>
            <h1 class="title">AgentQuery</h1>
          </div>
          <p class="subtitle">Natural language search across all x402 data sources</p>
          <div class="search-box">
            <input id="search-input" type="text" class="search-input"
              placeholder="What's CRO price? Compare ETH vs BTC volume..." value="\${query}" />
            <button id="search-btn" class="search-btn">\${loading ? '⏳' : '🔍'}</button>
          </div>
          <div class="try-section">
            Try: <button class="try-btn" onclick="setQuery('What is CRO price?')">CRO price</button>
            • <button class="try-btn" onclick="setQuery('Compare BTC and ETH volume')">Compare tokens</button>
          </div>
        </div>
        \${loading ? \`
          <div class="card card-amber" style="text-align:center">
            <div class="loading-spinner"></div>
            <p class="loading-text">Querying data sources...</p>
            </div>
          \` : ''}
          \${error ? \`
            <div class="card card-red fade-in">
              <h3 class="error-title">❌ Error</h3>
              <p class="error-text">\${error}</p>
            </div>
          \` : ''}
          \${result ? \`
            <div class="fade-in">
              <div class="card card-green">
                <h3 class="section-title">✅ Answer</h3>
                <p class="answer-text">\${result.summary}</p>
              </div>
              <div class="card card-purple">
                <h3 class="section-title">📊 Data</h3>
                <pre class="data-pre">\${JSON.stringify(result.data, null, 2)}</pre>
              </div>
              <div class="meta">
                <span>💰 Cost: $\${(parseInt(result.cost) / 1_000_000).toFixed(6)} USDC</span>
                <span>🔗 Sources: \${result.sources.length}</span>
              </div>
            </div>
          \` : ''}
      \`;
      
      document.getElementById('search-input').addEventListener('input', (e) => { query = e.target.value; });
      document.getElementById('search-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') search(); });
      document.getElementById('search-btn').addEventListener('click', search);
    }
    
    function setQuery(q) {
      query = q;
      render();
      document.getElementById('search-input').value = q;
    }
    
    async function search() {
      if (!query.trim() || loading) return;
      loading = true; error = null; result = null; render();
      try {
        const res = await fetch('/api/ai-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        if (!res.ok) throw new Error('Search failed');
        result = await res.json();
      } catch (err) {
        error = err.message;
      } finally {
        loading = false; render();
      }
    }
    render();
  </script>
</body>
</html>`;
  
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

function handleHealth(res: http.ServerResponse): void {
  sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
}

function handleStats(res: http.ServerResponse): void {
  const allServers = Array.from(servers.values());
  const projects = new Set(allServers.map(s => s.projectName));
  
  const stats: RegistryStats = {
    totalProjects: projects.size,
    totalServers: allServers.length,
    totalTools: allServers.reduce((sum, s) => sum + s.tools.length, 0),
    activeServers: allServers.filter(s => s.status === 'active').length,
    networks: {
      mainnet: allServers.filter(s => s.network === 'cronos-mainnet').length,
      testnet: allServers.filter(s => s.network === 'cronos-testnet').length,
    },
  };
  sendJSON(res, 200, stats);
}

function handleListServers(res: http.ServerResponse, url: URL): void {
  let results = Array.from(servers.values());

  const network = url.searchParams.get('network');
  if (network) {
    results = results.filter(s => s.network === network);
  }

  const status = url.searchParams.get('status');
  if (status) {
    results = results.filter(s => s.status === status);
  }

  const project = url.searchParams.get('project');
  if (project) {
    results = results.filter(s => s.projectName.toLowerCase() === project.toLowerCase());
  }

  results.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

  const publicResults = results.map(({ ownerAddress, ...rest }) => rest);

  sendJSON(res, 200, {
    count: publicResults.length,
    servers: publicResults,
  });
}

function handleListProjects(res: http.ServerResponse, url: URL): void {
  const allServers = Array.from(servers.values());
  
  const network = url.searchParams.get('network');
  const filteredServers = network 
    ? allServers.filter(s => s.network === network)
    : allServers;

  const projectMap = new Map<string, {
    name: string;
    servers: Array<{
      id: string;
      name: string;
      endpoint: string;
      network: string;
      toolCount: number;
      paidTools: number;
      freeTools: number;
      tools: ToolDefinition[];
    }>;
    totalTools: number;
    network: string;
  }>();

  for (const server of filteredServers) {
    const projectName = server.projectName || 'Unnamed Project';
    
    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, {
        name: projectName,
        servers: [],
        totalTools: 0,
        network: server.network,
      });
    }

    const project = projectMap.get(projectName)!;
    const paidTools = server.tools.filter(t => BigInt(t.price) > 0).length;
    const freeTools = server.tools.length - paidTools;

    project.servers.push({
      id: server.id,
      name: server.name,
      endpoint: server.endpoint,
      network: server.network,
      toolCount: server.tools.length,
      paidTools,
      freeTools,
      tools: server.tools,
    });
    project.totalTools += server.tools.length;
  }

  const projects = Array.from(projectMap.values());

  sendJSON(res, 200, {
    count: projects.length,
    projects,
  });
}

function handleSearchTools(res: http.ServerResponse, url: URL): void {
  const query = url.searchParams.get('q')?.toLowerCase() || '';
  const maxPrice = url.searchParams.get('maxPrice');
  const network = url.searchParams.get('network');

  const results: Array<{
    server: {
      id: string;
      name: string;
      projectName: string;
      endpoint: string;
      network: string;
    };
    tool: ToolDefinition;
  }> = [];

  for (const server of servers.values()) {
    if (network && server.network !== network) continue;

    for (const tool of server.tools) {
      const matchesQuery = !query || 
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query);

      const matchesPrice = !maxPrice || BigInt(tool.price) <= BigInt(maxPrice);

      if (matchesQuery && matchesPrice) {
        results.push({
          server: {
            id: server.id,
            name: server.name,
            projectName: server.projectName,
            endpoint: server.endpoint,
            network: server.network,
          },
          tool,
        });
      }
    }
  }

  sendJSON(res, 200, {
    count: results.length,
    results,
  });
}

function handleGetServer(res: http.ServerResponse, id: string): void {
  const server = servers.get(id);
  if (!server) {
    sendJSON(res, 404, { error: 'Server not found' });
    return;
  }

  const { ownerAddress, ...publicServer } = server;
  sendJSON(res, 200, publicServer);
}

async function handleRegister(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req) as {
      endpoint: string;
      projectName?: string;
      name?: string;
      description?: string;
      version?: string;
      network?: string;
      paymentAddress?: string;
      ownerAddress?: string;
      tools?: ToolDefinition[];
      autoDetect?: boolean;
    };

    if (!body.endpoint) {
      sendJSON(res, 400, { error: 'endpoint is required' });
      return;
    }

    const endpoint = body.endpoint.replace(/\/$/, '');
    const id = generateId(endpoint);

    const existing = servers.get(id);
    if (existing && body.ownerAddress && existing.ownerAddress !== body.ownerAddress) {
      sendJSON(res, 403, { error: 'Server already registered by another owner' });
      return;
    }

    let serverData: Partial<RegisteredServer> = {
      id,
      endpoint,
      registeredAt: existing?.registeredAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'unknown',
      stats: existing?.stats || { totalCalls: 0, totalRevenue: '0', uptime: 100 },
    };

    if (body.autoDetect !== false) {
      const fetched = await fetchServerInfo(endpoint);

      if (fetched.info) {
        serverData.name = fetched.info.name;
        serverData.version = fetched.info.version;
        serverData.description = fetched.info.description;
        serverData.network = fetched.info.network === 'mainnet' ? 'cronos-mainnet' : 'cronos-testnet';
        serverData.paymentAddress = fetched.info.paymentAddress;
        serverData.status = 'active';
      }

      if (fetched.tools?.tools) {
        serverData.tools = fetched.tools.tools;
      }
    }

    if (body.projectName) serverData.projectName = body.projectName;
    if (body.name) serverData.name = body.name;
    if (body.description) serverData.description = body.description;
    if (body.version) serverData.version = body.version;
    if (body.network) serverData.network = body.network as 'cronos-mainnet' | 'cronos-testnet';
    if (body.paymentAddress) serverData.paymentAddress = body.paymentAddress;
    if (body.tools) serverData.tools = body.tools;

    serverData.ownerAddress = body.ownerAddress || existing?.ownerAddress || body.paymentAddress || '';

    serverData.projectName = serverData.projectName || serverData.name || 'Unnamed Project';
    serverData.network = serverData.network || 'cronos-testnet';
    serverData.version = serverData.version || '1.0.0';
    serverData.description = serverData.description || '';
    serverData.paymentAddress = serverData.paymentAddress || '';

    if (!serverData.name) {
      sendJSON(res, 400, { error: 'name is required' });
      return;
    }
    if (!serverData.tools || serverData.tools.length === 0) {
      sendJSON(res, 400, { error: 'tools are required' });
      return;
    }
    if (!serverData.ownerAddress) {
      sendJSON(res, 400, { error: 'ownerAddress is required' });
      return;
    }

    servers.set(id, serverData as RegisteredServer);

    sendJSON(res, existing ? 200 : 201, {
      message: existing ? 'Server updated' : 'Server registered',
      id,
      server: {
        ...serverData,
        ownerAddress: undefined,
      },
    });

  } catch (error) {
    sendJSON(res, 500, { error: 'Registration failed' });
  }
}

async function handleUpdate(req: http.IncomingMessage, res: http.ServerResponse, id: string): Promise<void> {
  try {
    const body = await parseBody(req) as {
      ownerAddress: string;
      projectName?: string;
      name?: string;
      description?: string;
      version?: string;
      network?: string;
      paymentAddress?: string;
      tools?: ToolDefinition[];
    };

    const existing = servers.get(id);
    if (!existing) {
      sendJSON(res, 404, { error: 'Server not found' });
      return;
    }

    if (!body.ownerAddress || body.ownerAddress !== existing.ownerAddress) {
      sendJSON(res, 403, { error: 'Invalid ownerAddress. You do not own this server.' });
      return;
    }

    if (body.projectName) existing.projectName = body.projectName;
    if (body.name) existing.name = body.name;
    if (body.description) existing.description = body.description;
    if (body.version) existing.version = body.version;
    if (body.network) existing.network = body.network as 'cronos-mainnet' | 'cronos-testnet';
    if (body.paymentAddress) existing.paymentAddress = body.paymentAddress;
    if (body.tools) existing.tools = body.tools;
    existing.lastSeenAt = new Date().toISOString();

    servers.set(id, existing);

    sendJSON(res, 200, {
      message: 'Server updated',
      server: {
        ...existing,
        ownerAddress: undefined,
      },
    });

  } catch (error) {
    sendJSON(res, 500, { error: 'Update failed' });
  }
}

async function handleDelete(req: http.IncomingMessage, res: http.ServerResponse, id: string): Promise<void> {
  try {
    const body = await parseBody(req) as { ownerAddress: string };

    const existing = servers.get(id);
    if (!existing) {
      sendJSON(res, 404, { error: 'Server not found' });
      return;
    }

    if (!body.ownerAddress || body.ownerAddress !== existing.ownerAddress) {
      sendJSON(res, 403, { error: 'Invalid ownerAddress. You do not own this server.' });
      return;
    }

    servers.delete(id);
    sendJSON(res, 200, { message: 'Server removed' });

  } catch (error) {
    sendJSON(res, 500, { error: 'Delete failed' });
  }
}

const PORT = parseInt(process.env.PORT || '3010', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const method = req.method || 'GET';
  const pathname = url.pathname;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    if (method === 'GET') {
      if (pathname === '/') {
        return serveHTMLPage(res, 'index.html');
      }
      
      if (pathname === '/explorer') {
        return serveHTMLPage(res, 'explorer.html');
      }
      
      if (pathname === '/docs') {
        return serveHTMLPage(res, 'docs.html');
      }
      
      if (pathname === '/register') {
        return serveHTMLPage(res, 'register.html');
      }
      
      if (pathname === '/transfer') {
        return serveHTMLPage(res, 'transfer.html');
      }
      
      if (pathname === '/agent-search') {
        return serveSearchPage(res);
      }

      if (pathname.includes('.')) {
        if (serveStaticFile(res, pathname)) {
          return;
        }
      }
    }

    if (method === 'GET' && pathname === '/health') {
      return handleHealth(res);
    }

    if (method === 'GET' && pathname === '/stats') {
      return handleStats(res);
    }

    if (method === 'GET' && pathname === '/servers') {
      return handleListServers(res, url);
    }

    if (method === 'GET' && pathname === '/projects') {
      return handleListProjects(res, url);
    }

    if (method === 'GET' && pathname === '/search') {
      return handleSearchTools(res, url);
    }
    
    if (method === 'POST' && pathname === '/api/ai-search') {
      return await handleAISearch(req, res);
    }

    const serverMatch = pathname.match(/^\/servers\/([^/]+)$/);
    if (serverMatch) {
      if (method === 'GET') {
        return handleGetServer(res, serverMatch[1]);
      }
      if (method === 'PUT') {
        return await handleUpdate(req, res, serverMatch[1]);
      }
      if (method === 'DELETE') {
        return await handleDelete(req, res, serverMatch[1]);
      }
    }

    if (method === 'POST' && pathname === '/register') {
      return await handleRegister(req, res);
    }

    sendJSON(res, 404, { error: 'Not found' });

  } catch (error) {
    sendJSON(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🗂️  CronosMCP Registry');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  🌐 Website:    http://${HOST}:${PORT}`);
  console.log(`  📡 API:        http://${HOST}:${PORT}/health`);
  console.log('');
  console.log('  Pages:');
  console.log('    /                 - Homepage');
  console.log('    /explorer         - Browse x402 tools');
  console.log('    /docs             - Documentation');
  console.log('    /register         - Register your server');
  console.log('    /transfer         - Gasless USDC.e transfer');
  console.log('    /agent-search     - AI-powered search (Grok)');
  console.log('');
  console.log('  API Endpoints:');
  console.log('    GET  /health          - Health check');
  console.log('    GET  /stats           - Registry statistics');
  console.log('    GET  /projects        - List projects (grouped servers)');
  console.log('    GET  /servers         - List all servers');
  console.log('    GET  /servers/:id     - Get server details');
  console.log('    GET  /search?q=       - Search tools');
  console.log('    POST /api/ai-search   - AI search (Grok)');
  console.log('    POST /register        - Register a server (API)');
  console.log('    PUT  /servers/:id     - Update server');
  console.log('    DELETE /servers/:id   - Remove server');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
});