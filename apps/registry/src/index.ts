// =============================================================================
// CronosMCP Registry - The Discovery Layer for x402 AI Tools on Cronos
// =============================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// In-Memory Storage (Production would use a database)
// =============================================================================

const servers: Map<string, RegisteredServer> = new Map();

// =============================================================================
// Static File Serving
// =============================================================================

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
  
  // Security: prevent directory traversal
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
    // File not found or error reading
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

// =============================================================================
// Helper Functions
// =============================================================================

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
    // Ignore
  }

  try {
    const toolsRes = await fetch(`${endpoint}/tools`);
    if (toolsRes.ok) {
      results.tools = await toolsRes.json();
    }
  } catch (e) {
    // Ignore
  }

  return results;
}

// =============================================================================
// Route Handlers
// =============================================================================

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

  // Remove ownerAddress from public response
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

  // Group by project
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

  // Remove ownerAddress from public response
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

    // Override with provided values
    if (body.projectName) serverData.projectName = body.projectName;
    if (body.name) serverData.name = body.name;
    if (body.description) serverData.description = body.description;
    if (body.version) serverData.version = body.version;
    if (body.network) serverData.network = body.network as 'cronos-mainnet' | 'cronos-testnet';
    if (body.paymentAddress) serverData.paymentAddress = body.paymentAddress;
    if (body.tools) serverData.tools = body.tools;

    // Set ownerAddress
    serverData.ownerAddress = body.ownerAddress || existing?.ownerAddress || body.paymentAddress || '';

    // Set defaults
    serverData.projectName = serverData.projectName || serverData.name || 'Unnamed Project';
    serverData.network = serverData.network || 'cronos-testnet';
    serverData.version = serverData.version || '1.0.0';
    serverData.description = serverData.description || '';
    serverData.paymentAddress = serverData.paymentAddress || '';

    // Validate required fields
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

// =============================================================================
// Main Server
// =============================================================================

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
    // =========================================================================
    // HTML Page Routes
    // =========================================================================
    if (method === 'GET') {
      // Homepage
      if (pathname === '/') {
        return serveHTMLPage(res, 'index.html');
      }
      
      // Explorer (x402 tools directory)
      if (pathname === '/explorer') {
        return serveHTMLPage(res, 'explorer.html');
      }
      
      // Documentation
      if (pathname === '/docs') {
        return serveHTMLPage(res, 'docs.html');
      }
      
      // Register page (HTML form)
      if (pathname === '/register') {
        return serveHTMLPage(res, 'register.html');
      }
      
      // Gasless Transfer
      if (pathname === '/transfer') {
        return serveHTMLPage(res, 'transfer.html');
      }

      // Static files (css, js, images, etc.)
      if (pathname.includes('.')) {
        if (serveStaticFile(res, pathname)) {
          return;
        }
      }
    }

    // =========================================================================
    // API Routes
    // =========================================================================
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

    // API register endpoint (different from /register HTML page)
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
  console.log('    /register  - Register your server');
  console.log('    /transfer         - Gasless USDC.e transfer');
  console.log('');
  console.log('  API Endpoints:');
  console.log('    GET  /health          - Health check');
  console.log('    GET  /stats           - Registry statistics');
  console.log('    GET  /projects        - List projects (grouped servers)');
  console.log('    GET  /servers         - List all servers');
  console.log('    GET  /servers/:id     - Get server details');
  console.log('    GET  /search?q=       - Search tools');
  console.log('    POST /register        - Register a server (API)');
  console.log('    PUT  /servers/:id     - Update server');
  console.log('    DELETE /servers/:id   - Remove server');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
});