# Market Data MCP Server

x402-powered MCP server providing Crypto.com market data.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `get_price` | Free | Get current price for a token |
| `get_ohlcv` | $0.001 | Get OHLCV candlestick data |
| `get_orderbook` | $0.002 | Get order book depth |
| `get_trades` | $0.001 | Get recent trades |

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
CRYPTOCOM_API_KEY=your_api_key
```

## Documentation

- [Cronos x402 Facilitator](https://docs.cronos.org/cronos-x402-facilitator/)
- [Crypto.com Exchange API](https://exchange-docs.crypto.com/)