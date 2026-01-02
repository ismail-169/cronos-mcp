// =============================================================================
// @cronos-mcp/client-sdk - Service Registry
// =============================================================================

import { MCPClientConfig, ServiceEndpoint, PricedTool } from '@cronos-mcp/core';

export interface DiscoveredService {
  url: string;
  name: string;
  description?: string;
  version?: string;
  tools: PricedTool[];
}

/**
 * Registry for discovering and managing MCP services
 */
export class ServiceRegistry {
  private config: MCPClientConfig;
  private services: Map<string, DiscoveredService> = new Map();

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  /**
   * Discover services from registry URL
   */
  async discover(): Promise<ServiceEndpoint[]> {
    if (!this.config.registryUrl) {
      return [];
    }

    const response = await fetch(`${this.config.registryUrl}/services`);
    const data = await response.json() as { services: ServiceEndpoint[] };
    return data.services;
  }

  /**
   * Register a service manually
   */
  async addService(url: string): Promise<DiscoveredService> {
    // Fetch service info
    const infoResponse = await fetch(`${url}/info`);
    const info = await infoResponse.json() as {
      name: string;
      version: string;
      description?: string;
    };

    // Fetch tools
    const toolsResponse = await fetch(`${url}/tools`);
    const toolsData = await toolsResponse.json() as { tools: PricedTool[] };

    const service: DiscoveredService = {
      url,
      name: info.name,
      description: info.description,
      version: info.version,
      tools: toolsData.tools,
    };

    this.services.set(url, service);
    return service;
  }

  /**
   * Get a registered service
   */
  getService(url: string): DiscoveredService | undefined {
    return this.services.get(url);
  }

  /**
   * Get all registered services
   */
  getAllServices(): DiscoveredService[] {
    return Array.from(this.services.values());
  }

  /**
   * Find services with a specific tool
   */
  findServicesByTool(toolName: string): DiscoveredService[] {
    return this.getAllServices().filter(
      service => service.tools.some(tool => tool.name === toolName)
    );
  }

  /**
   * Get all available tools across services
   */
  getAllTools(): Array<PricedTool & { serverUrl: string }> {
    const tools: Array<PricedTool & { serverUrl: string }> = [];
    
    for (const service of this.services.values()) {
      for (const tool of service.tools) {
        tools.push({
          ...tool,
          serverUrl: service.url,
        });
      }
    }
    
    return tools;
  }

  /**
   * Remove a service
   */
  removeService(url: string): boolean {
    return this.services.delete(url);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * Create a service registry
 */
export function createRegistry(config: MCPClientConfig): ServiceRegistry {
  return new ServiceRegistry(config);
}