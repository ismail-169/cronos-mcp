// =============================================================================
// @cronos-mcp/server-sdk - MCP Server with x402 Payments
// =============================================================================

import { MCPServerConfig, PricedTool, PaymentRecord, CRONOS_NETWORKS } from '@cronos-mcp/core';
import { PaymentHandler, createPaymentHandler } from '@cronos-mcp/payment';
import { ToolRegistry, RegisteredTool, ToolHandler, createToolRegistry } from './tools.js';
import { X402Middleware, createMiddleware } from './middleware.js';
import { HttpTransport, createTransport, TransportConfig } from './transport.js';

export interface ServerConfig extends Omit<MCPServerConfig, 'tools'> {
  port?: number;
  host?: string;
  /** Registry URL for auto-registration (default: http://localhost:3010) */
  registryUrl?: string;
  /** Disable auto-registration with registry */
  disableRegistry?: boolean;
  /** Owner address for registry edits (defaults to paymentAddress) */
  ownerAddress?: string;
  /** Project name for grouping servers in registry */
  projectName?: string;
}

export interface AddToolOptions {
  name: string;
  description: string;
  price: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

/**
 * MCP Server with x402 payment support
 */
export class MCPServer {
  private config: ServerConfig;
  private toolRegistry: ToolRegistry;
  private paymentHandler: PaymentHandler;
  private middleware: X402Middleware;
  private transport: HttpTransport;
  private toolCalls: Map<string, number> = new Map();
  private startTime: number = Date.now();

  constructor(config: ServerConfig) {
    this.config = config;
    this.toolRegistry = createToolRegistry();
    this.paymentHandler = createPaymentHandler({
      paymentAddress: config.paymentAddress,
      network: config.network,
      facilitatorUrl: config.facilitatorUrl,
    });
    this.middleware = createMiddleware(this.paymentHandler);
    this.transport = createTransport({
      port: config.port,
      host: config.host,
    });

    this.setupRoutes();
  }

  /**
   * Add a tool to the server
   */
  addTool(options: AddToolOptions): void {
    this.toolRegistry.register({
      name: options.name,
      description: options.description,
      price: options.price,
      inputSchema: options.inputSchema,
      handler: options.handler,
    });
    // Initialize call counter
    this.toolCalls.set(options.name, 0);
  }

  /**
   * Increment tool call counter
   */
  private incrementToolCalls(toolName: string): void {
    const current = this.toolCalls.get(toolName) || 0;
    this.toolCalls.set(toolName, current + 1);
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // List tools
    this.transport.route('GET', '/tools', async () => ({
      status: 200,
      headers: {},
      body: {
        tools: this.toolRegistry.getDefinitions(),
      },
    }));

    // Server info
    this.transport.route('GET', '/info', async () => ({
      status: 200,
      headers: {},
      body: {
        name: this.config.name,
        version: this.config.version,
        description: this.config.description,
        network: this.config.network,
        paymentAddress: this.config.paymentAddress,
        tools: this.toolRegistry.size,
      },
    }));

    // Health check
    this.transport.route('GET', '/health', async () => ({
      status: 200,
      headers: {},
      body: { status: 'ok' },
    }));

    // =========================================================================
    // CONSOLIDATED STATS ENDPOINT (for dashboard)
    // =========================================================================
    this.transport.route('GET', '/stats', async () => {
      const payments = this.paymentHandler.getPayments();
      const totalRevenue = this.paymentHandler.getTotalRevenue();

      // Calculate per-tool stats
      const toolStatsMap = new Map<string, { calls: number; revenue: bigint }>();
      
      for (const payment of payments) {
        const existing = toolStatsMap.get(payment.toolName) || { calls: 0, revenue: BigInt(0) };
        toolStatsMap.set(payment.toolName, {
          calls: existing.calls + 1,
          revenue: existing.revenue + BigInt(payment.amount),
        });
      }

      // Build tool stats array (only paid tools)
      const tools = this.toolRegistry.getAll()
        .filter(tool => BigInt(tool.price) > 0)
        .map(tool => {
          const stats = toolStatsMap.get(tool.name) || { calls: 0, revenue: BigInt(0) };
          return {
            name: tool.name,
            price: tool.price,
            calls: this.toolCalls.get(tool.name) || 0,
            revenue: stats.revenue.toString(),
          };
        });

      // Get network ID
      const networkId = this.config.network === 'mainnet'
        ? CRONOS_NETWORKS.MAINNET.networkId
        : CRONOS_NETWORKS.TESTNET.networkId;

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: {
          serverName: this.config.name,
          network: networkId,
          totalRevenue: totalRevenue.toString(),
          transactionCount: payments.length,
          tools,
          recentPayments: payments
            .slice(-20)
            .reverse()
            .map(p => ({
              id: p.id,
              toolName: p.toolName,
              amount: p.amount,
              payer: p.payer,
              txHash: p.txHash,
              timestamp: p.timestamp,
              status: p.status,
            })),
          uptime: Date.now() - this.startTime,
        },
      };
    });

    // Payment stats (legacy)
    this.transport.route('GET', '/api/payments', async () => ({
      status: 200,
      headers: {},
      body: this.paymentHandler.getPayments(),
    }));

    // Revenue stats (legacy)
    this.transport.route('GET', '/api/stats/revenue', async () => ({
      status: 200,
      headers: {},
      body: { total: this.paymentHandler.getTotalRevenue().toString() },
    }));

    // Tool stats (legacy)
    this.transport.route('GET', '/api/stats/tools', async () => {
      const payments = this.paymentHandler.getPayments();
      const stats = new Map<string, { calls: number; revenue: bigint }>();
      
      for (const payment of payments) {
        const existing = stats.get(payment.toolName) || { calls: 0, revenue: BigInt(0) };
        stats.set(payment.toolName, {
          calls: existing.calls + 1,
          revenue: existing.revenue + BigInt(payment.amount),
        });
      }

      return {
        status: 200,
        headers: {},
        body: Array.from(stats.entries()).map(([name, data]) => ({
          name,
          calls: data.calls,
          revenue: data.revenue.toString(),
        })),
      };
    });
  }

  /**
   * Setup dynamic tool routes
   */
  private setupToolRoutes(): void {
    for (const tool of this.toolRegistry.getAll()) {
      this.transport.route('POST', `/tools/${tool.name}`, async (ctx) => {
        const paymentHeader = ctx.headers['x-payment'];
        
        // Process through middleware
        const result = await this.middleware.process({
          tool,
          paymentHeader,
          params: ctx.body as Record<string, unknown>,
        });

        // Payment required
        if (result.paymentRequired) {
          return {
            status: result.paymentRequired.status,
            headers: {},
            body: result.paymentRequired.body,
          };
        }

        // Payment error
        if (result.error) {
          return {
            status: 402,
            headers: {},
            body: { error: `Payment invalid: ${result.error}` },
          };
        }

        // Execute tool
        try {
          const toolResult = await tool.handler(ctx.body as Record<string, unknown>);
          
          // Increment call counter on successful execution
          this.incrementToolCalls(tool.name);
          
          return {
            status: 200,
            headers: {},
            body: {
              result: toolResult,
              payment: result.payment,
            },
          };
        } catch (error) {
          return {
            status: 500,
            headers: {},
            body: {
              error: error instanceof Error ? error.message : 'Tool execution failed',
            },
          };
        }
      });
    }
  }

  /**
   * Register with CronosMCP Registry
   */
  private async registerWithRegistry(): Promise<void> {
    if (this.config.disableRegistry) {
      return;
    }

    const registryUrl = this.config.registryUrl || 'http://localhost:3010';
    const host = this.transport['host'] || 'localhost';
    const port = this.transport['port'] || 3000;
    const endpoint = `http://${host}:${port}`;

    const networkId = this.config.network === 'mainnet'
      ? CRONOS_NETWORKS.MAINNET.networkId
      : CRONOS_NETWORKS.TESTNET.networkId;

    try {
      const response = await fetch(`${registryUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          projectName: this.config.projectName || this.config.name,
          name: this.config.name,
          description: this.config.description,
          version: this.config.version,
          network: networkId,
          paymentAddress: this.config.paymentAddress,
          ownerAddress: this.config.ownerAddress || this.config.paymentAddress,
          tools: this.toolRegistry.getDefinitions(),
          autoDetect: false,
        }),
      });

      if (response.ok) {
        console.log(`  ✅ Registered with CronosMCP Registry`);
      } else {
        const err = await response.json() as { error?: string };
        console.log(`  ⚠️  Registry registration failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      // Registry might not be running - that's okay
      console.log(`  ⚠️  Could not connect to registry (${registryUrl})`);
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    this.setupToolRoutes();
    await this.transport.start();
    
    const networkId = this.config.network === 'mainnet'
      ? CRONOS_NETWORKS.MAINNET.networkId
      : CRONOS_NETWORKS.TESTNET.networkId;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🚀 ${this.config.name} v${this.config.version}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  📡 Server:    http://${this.transport['host'] || 'localhost'}:${this.transport['port'] || 3000}`);
    console.log(`  🌐 Network:   ${networkId}`);
    console.log(`  💳 Payments:  ${this.config.paymentAddress.slice(0, 10)}...${this.config.paymentAddress.slice(-8)}`);
    console.log('');
    console.log('  Endpoints:');
    console.log(`    GET  /health    - Health check`);
    console.log(`    GET  /info      - Server info`);
    console.log(`    GET  /tools     - List available tools`);
    console.log(`    GET  /stats     - Server statistics (for dashboard)`);
    console.log(`    POST /tools/:n  - Execute a tool`);
    console.log('');
    console.log('  Registered Tools:');
    for (const tool of this.toolRegistry.getAll()) {
      const priceStr = BigInt(tool.price) === BigInt(0)
        ? 'FREE'
        : `$${(parseInt(tool.price) / 1_000_000).toFixed(6)}`;
      console.log(`    • ${tool.name} (${priceStr})`);
    }
    console.log('');

    // Auto-register with CronosMCP Registry
    await this.registerWithRegistry();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.transport.stop();
  }

  /**
   * Get all payments
   */
  getPayments(): PaymentRecord[] {
    return this.paymentHandler.getPayments();
  }
}

/**
 * Create a new MCP server
 */
export function createServer(config: ServerConfig): MCPServer {
  return new MCPServer(config);
}