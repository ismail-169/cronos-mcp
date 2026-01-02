# =============================================================================
# CronosMCP Demo Agent
# =============================================================================
# CORRECTED per Official Cronos x402 Documentation
# Source: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
#
# CRITICAL CHANGES:
# 1. EIP-712 name: "Bridged USDC (Stargate)" (was "USD Coin")
# 2. EIP-712 version: "1" (was "2")
# 3. Added mainnet support with proper configuration
# =============================================================================

import asyncio
import httpx
import json
import base64
import time
import secrets
import os
from eth_account import Account
from eth_account.messages import encode_typed_data
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================

NETWORK = os.getenv("NETWORK", "testnet")

if NETWORK == "mainnet":
    CHAIN_ID = 25
    NETWORK_ID = "cronos-mainnet"
    RPC_URL = "https://evm.cronos.org"
    EXPLORER_URL = "https://explorer.cronos.org"
    # Stargate-bridged USDC.e - EIP-3009 compatible ✅
    # Introduced May 2025 with Stargate integration
    USDC_ADDRESS = "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C"
else:
    CHAIN_ID = 338
    NETWORK_ID = "cronos-testnet"
    RPC_URL = "https://evm-t3.cronos.org"
    EXPLORER_URL = "https://explorer.cronos.org/testnet"
    # Testnet devUSDC.e (Bridged USDC Stargate) - EIP-3009 compatible ✅
    USDC_ADDRESS = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"

# =============================================================================
# EIP-712 DOMAIN - OFFICIAL CRONOS X402 PARAMETERS
# =============================================================================
# Source: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
#
# CRITICAL: These values MUST match exactly or signature verification will fail!
#
# Common Pitfall from official docs:
#   WRONG:   { name: 'Bridged USDC', version: '2' }
#   CORRECT: { name: 'Bridged USDC (Stargate)', version: '1' }

EIP712_DOMAIN_NAME = "Bridged USDC (Stargate)"  # ✅ CORRECT (was "USD Coin")
EIP712_DOMAIN_VERSION = "1"                      # ✅ CORRECT (was "2")

# Server URLs
MARKET_DATA_SERVER_URL = os.getenv("MARKET_DATA_SERVER_URL", "http://localhost:3001")
ONCHAIN_ANALYTICS_SERVER_URL = os.getenv("ONCHAIN_ANALYTICS_SERVER_URL", "http://localhost:3002")


# =============================================================================
# PAYMENT CLIENT
# =============================================================================

class PaymentClient:
    """
    x402 Payment Client for CronosMCP servers.
    
    Uses OFFICIAL Cronos x402 EIP-712 parameters for signing payments.
    """
    
    def __init__(self, private_key: str, max_budget: int = 1_000_000):
        """
        Initialize payment client.

        Args:
            private_key: Wallet private key for signing
            max_budget: Maximum spend in base units (default $1.00 = 1,000,000)
        """
        self.account = Account.from_key(private_key)
        self.wallet_address = self.account.address
        self.max_budget = max_budget
        self.spent = 0

    async def call_tool(
        self,
        server_url: str,
        tool_name: str,
        params: dict
    ) -> dict:
        """
        Call a tool on an MCP server, handling payment automatically.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Initial request
            print(f"      → Calling {tool_name}...")
            response = await client.post(
                f"{server_url}/tools/{tool_name}",
                json=params,
                headers={"Content-Type": "application/json"}
            )

            # Step 2: Handle 402 Payment Required
            if response.status_code == 402:
                data = response.json()
                payment_requirements = data.get("paymentRequirements", {})

                amount = int(payment_requirements.get("maxAmountRequired", "0"))
                print(f"      → 402 Payment Required: {amount / 1_000_000:.6f} USDC")

                # Check budget
                if self.spent + amount > self.max_budget:
                    raise Exception(
                        f"Would exceed budget: {self.spent + amount} > {self.max_budget}"
                    )

                # Create and sign payment with OFFICIAL parameters
                print(f"      → Signing payment...")
                print(f"        Domain: name='{EIP712_DOMAIN_NAME}', version='{EIP712_DOMAIN_VERSION}'")
                payment_header = self._create_payment(payment_requirements)

                # Retry with payment
                print(f"      → Sending payment to server...")
                response = await client.post(
                    f"{server_url}/tools/{tool_name}",
                    json=params,
                    headers={
                        "Content-Type": "application/json",
                        "X-PAYMENT": payment_header,
                    }
                )

                if response.status_code == 200:
                    self.spent += amount
                    print(f"      ✅ Payment successful!")

            # Step 3: Handle response
            if response.status_code != 200:
                raise Exception(
                    f"Tool call failed: {response.status_code} - {response.text}"
                )

            result = response.json()
            return result.get("result", result)

    def _create_payment(self, requirements: dict) -> str:
        """
        Create a signed payment authorization using OFFICIAL Cronos x402 parameters.

        CRITICAL: Domain parameters must match exactly:
        - name: "Bridged USDC (Stargate)"
        - version: "1"
        """
        # Generate random nonce (32 bytes)
        nonce = "0x" + secrets.token_hex(32)

        # Timestamps (in SECONDS, not milliseconds!)
        valid_after = 0
        valid_before = int(time.time()) + 300  # 5 minutes from now

        # =================================================================
        # EIP-712 Domain - OFFICIAL CRONOS X402 PARAMETERS
        # =================================================================
        domain = {
            "name": EIP712_DOMAIN_NAME,        # "Bridged USDC (Stargate)" ✅
            "version": EIP712_DOMAIN_VERSION,  # "1" ✅
            "chainId": CHAIN_ID,
            "verifyingContract": requirements["asset"],
        }

        # EIP-712 Types (TransferWithAuthorization from EIP-3009)
        types = {
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ]
        }

        # Message to sign
        message = {
            "from": self.wallet_address,
            "to": requirements["payTo"],
            "value": int(requirements["maxAmountRequired"]),
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce,
        }

        # Sign with EIP-712
        signable = encode_typed_data(domain, types, message)
        signed = self.account.sign_message(signable)

        # Create payload
        payload = {
            "x402Version": 1,
            "scheme": requirements.get("scheme", "exact"),
            "network": requirements["network"],
            "payload": {
                "from": self.wallet_address,
                "to": requirements["payTo"],
                "value": requirements["maxAmountRequired"],
                "validAfter": valid_after,
                "validBefore": valid_before,
                "nonce": nonce,
                "signature": "0x" + signed.signature.hex(),
                "asset": requirements["asset"],
            },
        }

        # Base64 encode
        return base64.b64encode(json.dumps(payload).encode()).decode()


# =============================================================================
# MAIN DEMO
# =============================================================================

async def main():
    # Load credentials
    private_key = os.getenv("PRIVATE_KEY")
    if not private_key:
        print("❌ Error: PRIVATE_KEY not set in .env file")
        print()
        print("Create a .env file with:")
        print("  PRIVATE_KEY=0x...")
        print("  MAX_BUDGET=1000000")
        print("  NETWORK=testnet")
        print()
        print("Get testnet tokens from: https://faucet.cronos.org")
        return

    # Initialize client
    client = PaymentClient(
        private_key=private_key,
        max_budget=int(os.getenv("MAX_BUDGET", "1000000"))
    )

    print("🚀 CronosMCP Demo Agent")
    print("=" * 60)
    print()
    print("📋 Using OFFICIAL Cronos x402 EIP-712 parameters:")
    print(f"   Domain Name:    {EIP712_DOMAIN_NAME}")
    print(f"   Domain Version: {EIP712_DOMAIN_VERSION}")
    print()
    print(f"💳 Wallet: {client.wallet_address[:10]}...{client.wallet_address[-8:]}")
    print(f"💰 Budget: {client.max_budget / 1_000_000:.6f} USDC")
    print(f"🌐 Network: {NETWORK_ID} (Chain ID: {CHAIN_ID})")
    print(f"🪙 USDC: {USDC_ADDRESS[:10]}...{USDC_ADDRESS[-8:]}")
    print()

    if NETWORK == "mainnet":
        print("✅ Using Stargate USDC.e (EIP-3009 compatible)")
        print()

    # =================================
    # Test 1: Free Tool - get_price
    # =================================
    print("📊 [FREE] Fetching CRO price...")
    try:
        result = await client.call_tool(
            MARKET_DATA_SERVER_URL,
            "get_price",
            {"symbol": "CRO"}
        )
        price = result.get("price") or result.get("result", {}).get("price")
        print(f"   CRO Price: ${price or 'N/A'}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 2: Paid Tool - get_ohlcv
    # =================================
    print("📈 [PAID $0.001] Fetching BTC OHLCV data...")
    try:
        result = await client.call_tool(
            MARKET_DATA_SERVER_URL,
            "get_ohlcv",
            {"symbol": "BTC", "timeframe": "1h", "limit": 25}
        )
        candles = result.get("candles") or result.get("result", {}).get("candles", [])
        print(f"   ✅ Got {len(candles)} candles")
        if candles:
            latest = candles[-1]
            print(f"   Latest: Open=${latest.get('open', 'N/A')}, Close=${latest.get('close', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 3: Free Tool - get_balance
    # =================================
    print("💰 [FREE] Fetching wallet balance...")
    try:
        result = await client.call_tool(
            ONCHAIN_ANALYTICS_SERVER_URL,
            "get_balance",
            {"address": client.wallet_address}
        )
        balance = result.get("balance") or result.get("result", {}).get("balance")
        print(f"   Balance: {balance or 'N/A'} CRO")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()
# =================================
    # Test 4: Paid Tool - get_orderbook
    # =================================
    print("📚 [PAID $0.002] Fetching BTC order book...")
    try:
        result = await client.call_tool(
            MARKET_DATA_SERVER_URL,
            "get_orderbook",
            {"symbol": "BTC", "depth": 5}
        )
        bids = result.get("bids", [])
        asks = result.get("asks", [])
        print(f"   ✅ Got {len(bids)} bids, {len(asks)} asks")
        if bids:
            print(f"   Best bid: ${bids[0].get('price', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 5: Paid Tool - get_trades
    # =================================
    print("🔄 [PAID $0.001] Fetching recent CRO trades...")
    try:
        result = await client.call_tool(
            MARKET_DATA_SERVER_URL,
            "get_trades",
            {"symbol": "CRO", "count": 10}
        )
        trades = result.get("trades", [])
        print(f"   ✅ Got {len(trades)} recent trades")
        if trades:
            print(f"   Latest: {trades[0].get('price', 'N/A')} @ {trades[0].get('side', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 6: Paid Tool - get_transactions
    # =================================
    print("📜 [PAID $0.001] Fetching wallet transactions...")
    try:
        result = await client.call_tool(
            ONCHAIN_ANALYTICS_SERVER_URL,
            "get_transactions",
            {"address": client.wallet_address, "limit": 5}
        )
        txs = result.get("transactions", [])
        print(f"   ✅ Got {len(txs)} transactions")
        if txs:
            print(f"   Latest tx: {txs[0].get('hash', 'N/A')[:20]}...")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 7: Paid Tool - get_token_transfers
    # =================================
    print("🪙 [PAID $0.002] Fetching token transfers...")
    try:
        result = await client.call_tool(
            ONCHAIN_ANALYTICS_SERVER_URL,
            "get_token_transfers",
            {"address": client.wallet_address, "limit": 5}
        )
        transfers = result.get("transfers", [])
        print(f"   ✅ Got {len(transfers)} token transfers")
        if transfers:
            print(f"   Latest: {transfers[0].get('tokenSymbol', 'N/A')} - {transfers[0].get('value', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 8: Paid Tool - get_contract_info
    # =================================
    print("📋 [PAID $0.001] Fetching USDC contract info...")
    try:
        result = await client.call_tool(
            ONCHAIN_ANALYTICS_SERVER_URL,
            "get_contract_info",
            {"address": USDC_ADDRESS}
        )
        print(f"   ✅ Contract: {result.get('contractName', 'Unknown')}")
        print(f"   Verified: {result.get('isVerified', False)}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()

    # =================================
    # Test 9: Paid Tool - analyze_wallet (Most expensive)
    # =================================
    print("🔍 [PAID $0.005] Deep wallet analysis...")
    try:
        result = await client.call_tool(
            ONCHAIN_ANALYTICS_SERVER_URL,
            "analyze_wallet",
            {"address": client.wallet_address}
        )
        activity = result.get("activity", {})
        print(f"   ✅ Analysis complete")
        print(f"   Total sent: {activity.get('totalSent', '0')} CRO")
        print(f"   Total received: {activity.get('totalReceived', '0')} CRO")
        print(f"   Unique interactions: {activity.get('uniqueAddressesInteracted', 0)}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print()
    # =================================
    # Summary
    # =================================
    print("=" * 60)
    print(f"📈 Total spent: {client.spent / 1_000_000:.6f} USDC")
    print(f"💵 Remaining: {(client.max_budget - client.spent) / 1_000_000:.6f} USDC")

    if client.spent > 0:
        print(f"\n🔗 View transactions: {EXPLORER_URL}/address/{client.wallet_address}")


if __name__ == "__main__":
    asyncio.run(main())