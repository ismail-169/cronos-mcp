// =============================================================================
// @cronos-mcp/server-sdk - HTTP Transport
// =============================================================================

import { MCPServerConfig } from '@cronos-mcp/core';

export interface TransportConfig {
  port?: number;
  host?: string;
  cors?: boolean;
}

export interface RequestContext {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ResponseContext {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type RequestHandler = (ctx: RequestContext) => Promise<ResponseContext>;

/**
 * Simple HTTP transport for MCP server
 */
export class HttpTransport {
  public port: number;
  public host: string;
  private cors: boolean;
  private handlers: Map<string, RequestHandler> = new Map();
  private server: unknown = null;

  constructor(config: TransportConfig = {}) {
    this.port = config.port || 3000;
    this.host = config.host || 'localhost';
    this.cors = config.cors !== false; // Enable CORS by default
  }

  /**
   * Register a route handler
   */
  route(method: string, path: string, handler: RequestHandler): void {
    const key = `${method.toUpperCase()}:${path}`;
    this.handlers.set(key, handler);
  }

  /**
   * Get CORS headers
   */
  private getCorsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-PAYMENT, X-Payment',
    };
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    // Using native Node.js http module
    const http = await import('http');
    
    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${this.host}:${this.port}`);
      const method = req.method || 'GET';
      const path = url.pathname;
      const key = `${method}:${path}`;

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, this.getCorsHeaders());
        res.end();
        return;
      }

      // Collect headers
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      // Read body
      let body: unknown = {};
      if (method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          body = {};
        }
      }

      // Find handler
      const handler = this.handlers.get(key);
      if (!handler) {
        res.writeHead(404, { 
          'Content-Type': 'application/json',
          ...this.getCorsHeaders(),
        });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Execute handler
      try {
        const result = await handler({ method, path, headers, body });
        res.writeHead(result.status, {
          'Content-Type': 'application/json',
          ...this.getCorsHeaders(),
          ...result.headers,
        });
        res.end(JSON.stringify(result.body));
      } catch (error) {
        res.writeHead(500, { 
          'Content-Type': 'application/json',
          ...this.getCorsHeaders(),
        });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    await new Promise<void>((resolve) => {
      (this.server as ReturnType<typeof http.createServer>).listen(
        this.port,
        this.host,
        () => resolve()
      );
    });

    console.log(`🚀 Server running at http://${this.host}:${this.port}`);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        (this.server as ReturnType<typeof import('http').createServer>).close(() => resolve());
      });
    }
  }
}

/**
 * Create HTTP transport
 */
export function createTransport(config?: TransportConfig): HttpTransport {
  return new HttpTransport(config);
}