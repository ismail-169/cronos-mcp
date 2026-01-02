"""
CronosMCP Demo Agent Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Wallet Configuration
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
WALLET_ADDRESS = os.getenv("WALLET_ADDRESS", "")

# Network Configuration
CRONOS_RPC_URL = os.getenv("CRONOS_RPC_URL", "https://evm-t3.cronos.org")
CHAIN_ID = int(os.getenv("CHAIN_ID", "338"))

# MCP Server URLs
MARKET_DATA_SERVER_URL = os.getenv("MARKET_DATA_SERVER_URL", "http://localhost:3001")
ONCHAIN_ANALYTICS_SERVER_URL = os.getenv("ONCHAIN_ANALYTICS_SERVER_URL", "http://localhost:3002")

# Budget (in USDC base units, 6 decimals)
MAX_BUDGET = int(os.getenv("MAX_BUDGET", "1000000"))  # $1 default

# USDC Contract (Testnet devUSDC.e)
USDC_ADDRESS = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0"

# EIP-712 Domain for signing
EIP712_DOMAIN = {
    "name": "Bridged USDC (Stargate)",
    "version": "1",
    "chainId": str(CHAIN_ID),
}