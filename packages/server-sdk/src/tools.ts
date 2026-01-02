// =============================================================================
// @cronos-mcp/server-sdk - Tool Registry
// =============================================================================

import { PricedTool } from '@cronos-mcp/core';

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

export interface RegisteredTool extends PricedTool {
  handler: ToolHandler;
}

/**
 * Registry for MCP tools with pricing
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: RegisteredTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions (without handlers) for MCP protocol
   */
  getDefinitions(): PricedTool[] {
    return this.getAll().map(({ handler, ...tool }) => tool);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }
}

/**
 * Create a new tool registry
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}