# Onchain Analytics MCP Server

x402-powered MCP server providing Cronos blockchain analytics.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `get_balance` | Free | Get wallet balance |
| `get_transactions` | $0.001 | Get transaction history |
| `get_token_transfers` | $0.002 | Get ERC20 transfers |
| `get_contract_info` | $0.001 | Get contract metadata |
| `analyze_wallet` | $0.005 | Deep wallet analysis |

## Quick Start

```bash
# Install
npm install

# Run
npm run dev
```

## Configuration

```env
FACILITATOR_URL=https://facilitator.cronoslabs.org/v2/x402
PAYMENT_ADDRESS=0xYourAddress
CRONOS_RPC_URL=https://evm-t3.cronos.org
```

## Documentation

- [Cronos x402 Facilitator](https://docs.cronos.org/cronos-x402-facilitator/)
- [Cronos Explorer API](https://docs.cronos.org/block-explorers/block-explorer-and-api-keys)