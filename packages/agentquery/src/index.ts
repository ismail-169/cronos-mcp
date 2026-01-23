import { MCPClient, createClient } from '@cronos-mcp/client-sdk';

export interface AgentQueryConfig {
  llm: {
    provider: 'OpenAI' | 'Google' | 'Grok';
    model: string;
    apiKey: string;
  };
  servers: Array<{
    name: string;
    url: string;
    description?: string;
  }>;
  privateKey?: string;
  network?: 'testnet' | 'mainnet';
  maxBudget?: string;
}

export interface UnifiedResponse {
  summary: string;
  data: Record<string, unknown>;
  sources: string[];
  actions?: Array<{
    type: string;
    status: string;
    txHash?: string;
    error?: string;
  }>;
  cost: string;
  timestamp: number;
}

interface ServerInfo {
  name: string;
  url: string;
  description: string;
}

export class AgentQuery {
  private client?: MCPClient;
  private servers: Map<string, ServerInfo> = new Map();
  private llmConfig: AgentQueryConfig['llm'];

  constructor(config: AgentQueryConfig) {
    this.llmConfig = config.llm;

    if (config.privateKey) {
      this.client = createClient({
        privateKey: config.privateKey,
        network: config.network || 'testnet',
        maxBudget: config.maxBudget || '10000000',
      });
    }

    for (const server of config.servers) {
      this.servers.set(server.name, {
        name: server.name,
        url: server.url,
        description: server.description || '',
      });
    }
  }

  async query(naturalLanguage: string): Promise<UnifiedResponse> {
    const availableServers = Array.from(this.servers.values());
    const tools = await this.discoverTools();

    const plan = await this.createPlan(naturalLanguage, availableServers, tools);
    const results = await this.executePlan(plan.calls);
    const synthesis = await this.synthesize(naturalLanguage, results);

    const totalCost = results.reduce(
      (sum, r) => sum + BigInt(r.payment?.amount || '0'),
      BigInt(0)
    );

    return {
      summary: synthesis.summary,
      data: synthesis.data,
      sources: results.map(r => r.source).filter(Boolean),
      cost: totalCost.toString(),
      timestamp: Date.now(),
    };
  }

  private async discoverTools(): Promise<Record<string, any[]>> {
    const tools: Record<string, any[]> = {};

    for (const [name, server] of this.servers.entries()) {
      try {
        const response = await fetch(`${server.url}/tools`);
        const data = await response.json() as { tools?: any[] };
        tools[name] = data.tools || [];
      } catch {
        tools[name] = [];
      }
    }

    return tools;
  }

  private async createPlan(query: string, servers: ServerInfo[], tools: Record<string, any[]>) {
    const prompt = `Available servers: ${JSON.stringify(servers)}
Available tools: ${JSON.stringify(tools)}
User query: "${query}"

Return only JSON (no markdown):
{"reasoning": "brief", "calls": [{"server": "name", "tool": "name", "params": {}}]}`;

    const response = await this.callLLM(prompt);
    return this.extractJSON(response);
  }

  private async synthesize(query: string, results: any[]) {
    const prompt = `User: "${query}"
Results: ${JSON.stringify(results)}

Return only JSON (no markdown):
{"summary": "2-3 sentence answer", "data": {}}`;

    const response = await this.callLLM(prompt);
    return this.extractJSON(response);
  }

  private async callLLM(prompt: string): Promise<string> {
    if (this.llmConfig.provider === 'Grok') {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          stream: false,
        }),
      });

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0].message.content;
    }

    if (this.llmConfig.provider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0].message.content;
    }

    throw new Error(`Provider ${this.llmConfig.provider} not supported`);
  }

  private async executePlan(calls: any[]) {
    return Promise.all(calls.map(async (call) => {
      const server = this.servers.get(call.server);
      if (!server) {
        return { source: call.server, error: 'Server not found' };
      }

      try {
        if (this.client) {
          const result = await this.client.callTool(
            server.url,
            call.tool,
            call.params
          );
          return {
            source: `${call.server}/${call.tool}`,
            result: result.result,
            payment: result.payment,
          };
        } else {
          const response = await fetch(`${server.url}/tools/${call.tool}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(call.params),
          });
          const data = await response.json() as { result?: unknown };
          return {
            source: `${call.server}/${call.tool}`,
            result: data.result,
          };
        }
      } catch (error) {
        return {
          source: `${call.server}/${call.tool}`,
          error: String(error),
        };
      }
    }));
  }

  private extractJSON(response: string): any {
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                     response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
    return JSON.parse(response);
  }
}

export async function query(
  question: string,
  config: AgentQueryConfig
): Promise<UnifiedResponse> {
  const aq = new AgentQuery(config);
  return aq.query(question);
}