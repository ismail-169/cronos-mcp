// =============================================================================
// @cronos-mcp/cli - Project Templates
// =============================================================================

export const SERVER_TEMPLATE = `// MCP Server with x402 Payments
import { createServer } from '@cronos-mcp/server-sdk';

const server = createServer({
  name: '{{name}}',
  version: '1.0.0',
  paymentAddress: process.env.PAYMENT_ADDRESS!,
  facilitatorUrl: process.env.FACILITATOR_URL,
  network: 'testnet',
});

// Free tool
server.addTool({
  name: 'ping',
  description: 'Health check',
  price: '0',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ pong: true }),
});

// Paid tool
server.addTool({
  name: 'premium_data',
  description: 'Get premium data',
  price: '1000', // $0.001 USDC
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
  handler: async (params) => {
    return { data: \`Premium result for: \${params.query}\` };
  },
});

server.start();
`;

export const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{name}}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@cronos-mcp/server-sdk": "^0.1.0",
    "@cronos-mcp/core": "^0.1.0"
  },
  "devDependencies": {
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  }
}
`;

export const TSCONFIG_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
`;

export const ENV_TEMPLATE = `# MCP Server Configuration
PAYMENT_ADDRESS=0xYourPaymentAddress
FACILITATOR_URL=https://facilitator.cronoslabs.org/v2/x402
CRONOS_RPC_URL=https://evm-t3.cronos.org
`;

export const README_TEMPLATE = `# {{name}}

MCP Server with x402 payments on Cronos.

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
\`\`\`

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| ping | Free | Health check |
| premium_data | $0.001 | Get premium data |

## Documentation

- [CronosMCP](https://github.com/your-org/cronos-mcp)
- [Cronos x402 Facilitator](https://docs.cronos.org/cronos-x402-facilitator/)
`;

export interface TemplateContext {
  name: string;
  description?: string;
  paymentAddress?: string;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template
    .replace(/\{\{name\}\}/g, context.name)
    .replace(/\{\{description\}\}/g, context.description || '')
    .replace(/\{\{paymentAddress\}\}/g, context.paymentAddress || '');
}