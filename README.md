# ⚡ x402 Scraper Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Base L2](https://img.shields.io/badge/Settlement-Base%20L2-0052FF.svg)](https://base.org)
[![USDC](https://img.shields.io/badge/Currency-0.002%20USDC-2775CA.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare%20Workers-F38020.svg)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8A2BE2.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production HTTP 402 Web3 Microtransaction Scraper & Model Context Protocol (MCP) Server on Base L2.**  
> Convert any webpage into clean, token-efficient Markdown for AI agents with instant, permissionless on-chain micro-billing.

---

## 🌐 Live Production Endpoints

| Resource | URL | Method | Description |
| :--- | :--- | :---: | :--- |
| **Live Worker Base** | `https://x402-scraper-engine.gejoe-tt.workers.dev` | `GET` | Edge Root |
| **Health & Discovery** | `https://x402-scraper-engine.gejoe-tt.workers.dev/health` | `GET` | Service & pricing info |
| **Scrape Endpoint** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape` | `POST` | Core pay-per-call scraping engine |
| **OpenAPI 3.1 Spec** | `https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json` | `GET` | Machine-readable API schema |
| **x402 Protocol Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json` | `GET` | Autonomous payment discovery |
| **AI Plugin Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/ai-plugin.json` | `GET` | GPTs / AgentKit manifest |

---

## 💡 Why x402 Scraper?

- **Zero Signups & No API Keys:** No credit cards, accounts, or dashboard provisioning.
- **Pay-Per-Call Micropayments:** Only **$0.002 USDC** per scrape on Base L2.
- **AI-Optimized Markdown:** Strips `<script>`, `<style>`, `<svg>`, comments, ads, navbars, and base64 bloat. Delivers clean, token-minimized Markdown.
- **Native MCP Support:** Drop-in `clean_web_scrape` tool for Cursor, Claude Desktop, Antigravity, and autonomous agent frameworks.
- **Cryptographic Settlement:** Settles in ~2 seconds on Base with 24-hour KV replay protection.

---

## 🔄 HTTP 402 Flow Architecture

```
[ AI Agent / User ]                       [ Cloudflare Worker ]                      [ Base L2 RPC / KV ]
         |                                          |                                         |
         | ----- 1. POST /v1/scrape { url } ------> |                                         |
         |                                          | (No receipt)                            |
         | <---- 2. HTTP 402 Payment Required ----- |                                         |
         |          (X-Payment-To, Amount: 0.002)   |                                         |
         |                                          |                                         |
         | ===== 3. Broadcast 0.002 USDC Transfer on Base ==================================> |
         | <==== 4. Tx Finalized (tx_hash) ================================================== |
         |                                          |                                         |
         | ----- 5. POST /v1/scrape + Receipt ----> |                                         |
         |          (Header: X-Payment-Receipt)     | ----- 6. Verify Log & Age <= 15m -----> |
         |                                          | <---- 7. Status 0x1 Verified ---------- |
         |                                          | ----- 8. Write KV (Anti-Replay) ------> |
         |                                          |                                         |
         |                                          | [ Scrape & Sanitize HTML to Markdown ]  |
         | <---- 9. HTTP 200 OK (Clean Markdown) -- |                                         |
```

---

## 🚀 Quickstart: cURL Examples

### 1. Request Scrape (Receive 402 Challenge)

```bash
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com"}'
```

**HTTP 402 Response Headers & Body:**
```http
HTTP/2 402 
content-type: application/json
x-payment-version: 1
x-payment-network: base
x-payment-chain-id: 8453
x-payment-asset: USDC
x-payment-asset-address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
x-payment-amount: 0.002
x-payment-to: 0x4107f297256E00F32873f45F50A35a902c1c2034
x-payment-window: 900
```

```json
{
  "error": "Payment Required",
  "message": "This endpoint requires an on-chain microtransaction of 0.002 USDC on Base.",
  "payment": {
    "version": 1,
    "network": "base",
    "chainId": 8453,
    "asset": "USDC",
    "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "0.002",
    "recipient": "0x4107f297256E00F32873f45F50A35a902c1c2034",
    "windowSeconds": 900,
    "instruction": "Transfer 0.002 USDC to 0x4107f297256E00F32873f45F50A35a902c1c2034 on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'"
  }
}
```

### 2. Resubmit with On-Chain Payment Receipt

Once you broadcast `0.002 USDC` to the treasury address, pass the transaction hash in the `X-Payment-Receipt` header:

```bash
curl -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -H "X-Payment-Receipt: 0x5a12f9b8c34d...your_base_tx_hash..." \
  -d '{"url": "https://news.ycombinator.com"}'
```

**HTTP 200 Response Payload:**
```json
{
  "success": true,
  "url": "https://news.ycombinator.com",
  "title": "Hacker News",
  "markdown": "# Hacker News\n\n- [Show HN: x402 Scraper Engine](https://...)\n- [Ask HN: Best practices for LLM token optimization](https://...)",
  "tokens_estimated": 185,
  "payment": {
    "tx_hash": "0x5a12f9b8c34d...",
    "network": "base",
    "amount": "0.002",
    "asset": "USDC",
    "settled_at": "2026-09-02T13:42:00.000Z"
  }
}
```

---

## 🤖 Model Context Protocol (MCP) Integration

Equip your AI Agents (Claude Desktop, Cursor, Antigravity, OpenDevin) with autonomous paid web scraping in one click:

### Claude Desktop / Cursor Config (`mcp.json`)

```json
{
  "mcpServers": {
    "x402-scraper": {
      "command": "npx",
      "args": ["-y", "@asot/x402-scraper-mcp"],
      "env": {
        "WORKER_URL": "https://x402-scraper-engine.gejoe-tt.workers.dev",
        "BASE_RPC_URL": "https://mainnet.base.org",
        "AGENT_PRIVATE_KEY": "0xYourAgentFundedPrivateKey"
      }
    }
  }
}
```

### Smithery CLI Install
```bash
npx -y @smithery/cli install @asot/x402-scraper-engine --client claude
```

---

## 🐍 Python Integration Example

```python
import requests
from web3 import Web3

WORKER_URL = "https://x402-scraper-engine.gejoe-tt.workers.dev"
TARGET_URL = "https://example.com"

# 1. Initial Call (Trigger 402)
res = requests.post(f"{WORKER_URL}/v1/scrape", json={"url": TARGET_URL})

if res.status_code == 402:
    challenge = res.json()["payment"]
    print(f"Payment Required: {challenge['amount']} {challenge['asset']} to {challenge['recipient']}")
    
    # 2. Transfer USDC using Web3.py on Base (Chain ID 8453)...
    # tx_hash = send_usdc_on_base(challenge['recipient'], 2000) # 0.002 USDC
    
    # 3. Resubmit with Receipt Header
    paid_res = requests.post(
        f"{WORKER_URL}/v1/scrape",
        headers={"X-Payment-Receipt": tx_hash},
        json={"url": TARGET_URL}
    )
    print(paid_res.json()["markdown"])
```

---

## 🛡️ Security Architecture

| Defense | Implementation | Purpose |
| :--- | :--- | :--- |
| **SSRF Filter** | `src/scraper.ts` | Rejects `127.0.0.1`, RFC1918 private subnets, cloud metadata (`169.254.169.254`), and non-HTTP protocols. |
| **Anti-Replay Cache** | Cloudflare KV (`PROCESSED_TXS`) | Hashes are recorded with 24h TTL. Double-spending attempts receive HTTP 400. |
| **Freshness Window** | `src/verifier.ts` | Discards receipts older than 15 minutes (900s). |
| **Log Validation** | Base JSON-RPC | Verifies ERC20 Transfer event signature, official Base USDC address, recipient, and amount. |
| **Zero Key Storage** | Cloudflare Edge | Worker holds zero private keys. Completely non-custodial. |

---

## 📦 Registry & Aggregator Indexing

This project publishes standard schemas for automated indexing across agent marketplaces:

- **OpenAPI 3.1 Specification:** [`openapi.json`](openapi.json)
- **Smithery MCP Manifest:** [`smithery.yaml`](smithery.yaml)
- **Model Context Protocol Schema:** [`server.json`](server.json)
- **AI Plugin Manifest:** [`.well-known/ai-plugin.json`](.well-known/ai-plugin.json)

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Built by **[ASOT Marketing and Investment](https://getguruautomations.com)**.
