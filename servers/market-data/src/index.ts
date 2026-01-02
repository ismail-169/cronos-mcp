import 'dotenv/config';
// =============================================================================
// Market Data MCP Server
// x402-powered market data from Crypto.com Exchange API v1
// Docs: https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html
// =============================================================================

import { createServer } from '@cronos-mcp/server-sdk';
import { usdToBaseUnits } from '@cronos-mcp/core';

// Crypto.com Exchange API v1
const EXCHANGE_API = 'https://api.crypto.com/exchange/v1';

// Create server
const server = createServer({
  projectName: 'CronosMCP',
  name: 'market-data-server',
  version: '1.0.0',
  description: 'Crypto.com market data with x402 payments',
  paymentAddress: process.env.PAYMENT_ADDRESS ?? '0x0000000000000000000000000000000000000000',
  facilitatorUrl: process.env.FACILITATOR_URL ?? 'https://facilitator.cronoslabs.org/v2/x402',
  network: (process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as 'testnet' | 'mainnet',
  port: parseInt(process.env.PORT ?? '3001'),
});

// Free tool: Get current price
server.addTool({
  name: 'get_price',
  description: 'Get current price for a trading pair (free)',
  price: '0',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Base currency symbol (e.g., CRO, BTC, ETH)',
      },
      quote: {
        type: 'string',
        description: 'Quote currency (default: USD)',
        default: 'USD',
      },
    },
    required: ['symbol'],
  },
  handler: async (params) => {
    const symbol = (params.symbol as string).toUpperCase();
    const quote = ((params.quote as string) || 'USD').toUpperCase();
    const instrumentName = `${symbol}_${quote}`;
    
    try {
      const url = `${EXCHANGE_API}/public/get-tickers?instrument_name=${instrumentName}`;
      console.log('Fetching:', url);
      
      const response = await fetch(url);
      const data = await response.json() as {
        code?: number;
        result?: {
          data?: Array<{
            i: string;   // Instrument name
            a: string;   // Latest trade price
            b: string;   // Best bid
            k: string;   // Best ask
            h: string;   // 24h high
            l: string;   // 24h low
            v: string;   // 24h volume
            vv: string;  // 24h volume value in USD
            c: string;   // 24h change
            t: number;   // Timestamp
          }>;
        };
      };
      
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.code === 0 && data.result?.data?.[0]) {
        const ticker = data.result.data[0];
        return {
          symbol,
          quote,
          instrumentName: ticker.i,
          price: ticker.a,
          bid: ticker.b,
          ask: ticker.k,
          high24h: ticker.h,
          low24h: ticker.l,
          volume24h: ticker.v,
          volumeUsd24h: ticker.vv,
          change24h: ticker.c,
          timestamp: ticker.t,
        };
      }
      
      return { 
        symbol, 
        quote,
        instrumentName,
        error: 'Instrument not found or no data',
        code: data.code,
      };
    } catch (error) {
      return { error: 'Failed to fetch price', symbol, details: String(error) };
    }
  },
});

// Paid tool: Get OHLCV candlestick data
server.addTool({
  name: 'get_ohlcv',
  description: 'Get OHLCV candlestick data for a trading pair',
  price: usdToBaseUnits(0.001), // $0.001
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Base currency symbol',
      },
      quote: {
        type: 'string',
        description: 'Quote currency (default: USD)',
        default: 'USD',
      },
      timeframe: {
        type: 'string',
        enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1D'],
        description: 'Candlestick timeframe',
      },
      count: {
        type: 'number',
        description: 'Number of candles (max 300)',
        default: 25,
      },
    },
    required: ['symbol', 'timeframe'],
  },
  handler: async (params) => {
    const symbol = (params.symbol as string).toUpperCase();
    const quote = ((params.quote as string) || 'USD').toUpperCase();
    const instrumentName = `${symbol}_${quote}`;
    const timeframe = params.timeframe as string;
    const count = Math.min(params.count as number || 25, 300);
    
    try {
      const url = `${EXCHANGE_API}/public/get-candlestick?instrument_name=${instrumentName}&timeframe=${timeframe}&count=${count}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        code?: number;
        result?: {
          instrument_name: string;
          interval: string;
          data?: Array<{
            t: number;
            o: string;
            h: string;
            l: string;
            c: string;
            v: string;
          }>;
        };
      };
      
      if (data.code === 0 && data.result?.data) {
        return {
          symbol,
          quote,
          instrumentName: data.result.instrument_name,
          timeframe: data.result.interval,
          candles: data.result.data.map(c => ({
            timestamp: c.t,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: c.v,
          })),
        };
      }
      
      return { error: 'Data not found', symbol, timeframe, code: data.code };
    } catch (error) {
      return { error: 'Failed to fetch OHLCV', symbol, details: String(error) };
    }
  },
});

// Paid tool: Get order book depth
server.addTool({
  name: 'get_orderbook',
  description: 'Get order book depth for a trading pair',
  price: usdToBaseUnits(0.002), // $0.002
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Base currency symbol',
      },
      quote: {
        type: 'string',
        description: 'Quote currency (default: USD)',
        default: 'USD',
      },
      depth: {
        type: 'number',
        description: 'Order book depth (max 50)',
        default: 10,
      },
    },
    required: ['symbol'],
  },
  handler: async (params) => {
    const symbol = (params.symbol as string).toUpperCase();
    const quote = ((params.quote as string) || 'USD').toUpperCase();
    const instrumentName = `${symbol}_${quote}`;
    const depth = Math.min(params.depth as number || 10, 50);
    
    try {
      const url = `${EXCHANGE_API}/public/get-book?instrument_name=${instrumentName}&depth=${depth}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        code?: number;
        result?: {
          instrument_name: string;
          depth: number;
          data?: Array<{
            bids: Array<[string, string, string]>;
            asks: Array<[string, string, string]>;
          }>;
        };
      };
      
      if (data.code === 0 && data.result?.data?.[0]) {
        const book = data.result.data[0];
        return {
          symbol,
          quote,
          instrumentName: data.result.instrument_name,
          bids: book.bids?.map(b => ({ price: b[0], quantity: b[1], orders: b[2] })) || [],
          asks: book.asks?.map(a => ({ price: a[0], quantity: a[1], orders: a[2] })) || [],
        };
      }
      
      return { error: 'Order book not found', symbol, code: data.code };
    } catch (error) {
      return { error: 'Failed to fetch order book', symbol, details: String(error) };
    }
  },
});

// Paid tool: Get recent trades
server.addTool({
  name: 'get_trades',
  description: 'Get recent trades for a trading pair',
  price: usdToBaseUnits(0.001), // $0.001
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Base currency symbol',
      },
      quote: {
        type: 'string',
        description: 'Quote currency (default: USD)',
        default: 'USD',
      },
      count: {
        type: 'number',
        description: 'Number of trades (max 200)',
        default: 50,
      },
    },
    required: ['symbol'],
  },
  handler: async (params) => {
    const symbol = (params.symbol as string).toUpperCase();
    const quote = ((params.quote as string) || 'USD').toUpperCase();
    const instrumentName = `${symbol}_${quote}`;
    const count = Math.min(params.count as number || 50, 200);
    
    try {
      const url = `${EXCHANGE_API}/public/get-trades?instrument_name=${instrumentName}&count=${count}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        code?: number;
        result?: {
          data?: Array<{
            d: string;   // Trade ID
            t: number;   // Timestamp ms
            p: string;   // Price
            q: string;   // Quantity
            s: string;   // Side
            i: string;   // Instrument
          }>;
        };
      };
      
      if (data.code === 0 && data.result?.data) {
        return {
          symbol,
          quote,
          instrumentName,
          trades: data.result.data.map(t => ({
            tradeId: t.d,
            timestamp: t.t,
            price: t.p,
            quantity: t.q,
            side: t.s,
          })),
        };
      }
      
      return { error: 'Trades not found', symbol, code: data.code };
    } catch (error) {
      return { error: 'Failed to fetch trades', symbol, details: String(error) };
    }
  },
});

// Start server
server.start().catch(console.error);