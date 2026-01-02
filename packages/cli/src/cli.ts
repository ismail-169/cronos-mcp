#!/usr/bin/env node
// =============================================================================
// @cronos-mcp/cli - Command Line Interface
// =============================================================================

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  SERVER_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  TSCONFIG_TEMPLATE,
  ENV_TEMPLATE,
  README_TEMPLATE,
  renderTemplate,
} from './templates.js';

const program = new Command();

program
  .name('cronos-mcp')
  .description('CLI for scaffolding CronosMCP servers')
  .version('0.1.0');

program
  .command('init <name>')
  .description('Create a new MCP server project')
  .option('-d, --description <desc>', 'Project description')
  .option('-p, --payment-address <address>', 'Payment address')
  .action(async (name: string, options) => {
    const projectDir = path.join(process.cwd(), name);

    // Check if directory exists
    if (fs.existsSync(projectDir)) {
      console.error(`Error: Directory ${name} already exists`);
      process.exit(1);
    }

    console.log(`\n🚀 Creating CronosMCP server: ${name}\n`);

    // Create directories
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

    const context = {
      name,
      description: options.description || `${name} MCP server`,
      paymentAddress: options.paymentAddress || '0xYourPaymentAddress',
    };

    // Write files
    const files = [
      { path: 'src/index.ts', content: renderTemplate(SERVER_TEMPLATE, context) },
      { path: 'package.json', content: renderTemplate(PACKAGE_JSON_TEMPLATE, context) },
      { path: 'tsconfig.json', content: TSCONFIG_TEMPLATE },
      { path: '.env.example', content: ENV_TEMPLATE },
      { path: 'README.md', content: renderTemplate(README_TEMPLATE, context) },
    ];

    for (const file of files) {
      const filePath = path.join(projectDir, file.path);
      fs.writeFileSync(filePath, file.content);
      console.log(`  ✓ Created ${file.path}`);
    }

    console.log(`
✅ Project created successfully!

Next steps:
  cd ${name}
  npm install
  cp .env.example .env
  # Edit .env with your payment address
  npm run dev
`);
  });

program
  .command('add-tool <name>')
  .description('Add a new tool to the current server')
  .option('-p, --price <price>', 'Tool price in USDC base units', '0')
  .option('-d, --description <desc>', 'Tool description')
  .action((name: string, options) => {
    const toolCode = `
// Add this to your server:
server.addTool({
  name: '${name}',
  description: '${options.description || name}',
  price: '${options.price}',
  inputSchema: {
    type: 'object',
    properties: {
      // Add your input parameters here
    },
    required: [],
  },
  handler: async (params) => {
    // Implement your tool logic here
    return { result: 'success' };
  },
});
`;
    console.log(toolCode);
  });

program.parse();