# CronosMCP Demo Agent

Python AI agent demonstrating x402 payments with MCP servers.

## Features

- 🤖 AI agent with budget management
- 💳 Automatic x402 payment signing
- 🔧 MCP tool discovery and usage
- 📊 Market data and analytics queries

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run agent
python agent.py
```

## Configuration

```env
PRIVATE_KEY=your_private_key
WALLET_ADDRESS=your_wallet
MARKET_DATA_SERVER_URL=http://localhost:3001
MAX_BUDGET=1000000
```

## Documentation

- [Crypto.com AI Agent SDK](https://ai-agent-sdk-docs.crypto.com/)
- [Cronos x402 Facilitator](https://docs.cronos.org/cronos-x402-facilitator/)