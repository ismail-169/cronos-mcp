<p align="center">
  <img src="apps/registry/public/cronos_mcp.webp" alt="CronosMCP" width="200">
</p>

<h1 align="center">CronosMCP</h1>

<p align="center">
  <strong>x402 Payment Infrastructure for Cronos</strong>
</p>

<p align="center">
  Enable  agents to autonomously pay for premium tools using x402 micropayments.
</p>

<p align="center">
  <a href="https://cronosmcp.com">Website</a> •
  <a href="https://docs.cronosmcp.com">Docs</a> •
  <a href="https://cronosmcp.com/explorer">Explorer</a>
</p>

---

## Features

- **SDK** — Build your own x402-enabled tools
- **Explorer** — Discover x402 tools on Cronos
- **Gasless Transfers** — Send USDC.e without gas fees
- **Market Data API** — Crypto prices, OHLCV, order books
- **Onchain Analytics API** — Balances, transactions, token data

---

## Quick Start

```bash
npm install @cronos-mcp/server-sdk
```

```typescript
import { X402Server } from '@cronos-mcp/server-sdk';

const server = new X402Server({
  name: 'my-api',
  paymentAddress: '0xYourWallet',
});

server.addTool({
  name: 'premium_data',
  price: '1000', // $0.001 USDC.e
  handler: async (params) => {
    return { data: 'Premium content!' };
  },
});

server.start(3000);
```

---

## Links

- [Website](https://cronosmcp.com)
- [Documentation](https://docs.cronosmcp.com)
- [Explorer](https://cronosmcp.com/explorer)
- [Cronos x402 Docs](https://docs.cronos.org/cronos-x402-facilitator)

---
