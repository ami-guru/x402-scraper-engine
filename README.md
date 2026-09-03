# ⚡ x402 Scraper & Deep Search Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Base L2](https://img.shields.io/badge/Settlement-Base%20L2-0052FF.svg)](https://base.org)
[![USDC](https://img.shields.io/badge/Currency-USDC%20on%20Base-2775CA.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare%20Workers-F38020.svg)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8A2BE2.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production HTTP 402 Web3 Microtransaction Scraper & Deep Search Tool on Base L2.**  
> Convert any webpage into clean, token-efficient Markdown or conduct multi-source web research with instant, permissionless on-chain micro-billing.

---

## 🌐 Live Production Endpoints

| Resource | URL | Method | Price | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Health & Discovery** | `https://x402-scraper-engine.gejoe-tt.workers.dev/health` | `GET` | **Free** | Service status & pricing manifest |
| **Clean Scrape** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape` | `POST` | **$0.02 USDC** | Scrape URL to token-efficient Markdown |
| **Deep Search** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search` | `POST` | **$0.05 USDC** | Multi-source web search & deep extraction |
| **OpenAPI 3.1 Spec** | `https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json` | `GET` | **Free** | Machine-readable API schema |
| **x402 Protocol Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json` | `GET` | **Free** | Autonomous payment discovery |
| **AI Plugin Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/ai-plugin.json` | `GET` | **Free** | GPTs / AgentKit manifest |

---

## 💡 Why x402 Scraper?

- **Zero Signups & No API Keys:** No credit cards, accounts, or dashboard provisioning.
- **Pay-Per-Call Micropayments:** Only **$0.02 USDC** for single scrape, **$0.05 USDC** for multi-source search on Base L2.
- **AI-Optimized Markdown:** Strips `<script>`, `<style>`, `<svg>`, comments, ads, navbars, and base64 bloat. Delivers clean, token-minimized Markdown (~80% token savings).
- **Native MCP Support:** Drop-in `clean_web_scrape` and `clean_web_search` tools for Cursor, Claude Desktop, Antigravity, and autonomous agent frameworks.
- **Cryptographic Settlement:** Settles in ~2 seconds on Base with 24-hour KV replay protection.

---

## 🔄 HTTP 402 Flow Architecture

```
[ AI Agent / User ]                       [ Cloudflare Worker ]                      [ Base L2 RPC / KV ]
         |                                          |                                         |
         | ----- 1. POST /v1/scrape { url } ------> |                                         |
         |                                          | (No receipt)                            |
         | <---- 2. HTTP 402 Payment Required ----- |                                         |
         |          (X-Payment-To, Amount: 0.02)    |                                         |
         |                                          |                                         |
         | ===== 3. Broadcast 0.02 USDC Transfer on Base ===================================> |
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

### 1. Scrape URL ($0.02 USDC)

```bash
# Step A: Request Scrape (Receive 402 Challenge)
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com"}'

# Step B: Resubmit with On-Chain Payment Receipt
curl -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -H "X-Payment-Receipt: 0x...your_base_tx_hash..." \
  -d '{"url": "https://news.ycombinator.com"}'
```

### 2. Deep Search & Multi-Source Scrape ($0.05 USDC)

```bash
# Step A: Request Search (Receive 402 Challenge for 0.05 USDC)
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "latest autonomous AI agent protocols 2026", "limit": 3}'

# Step B: Resubmit with On-Chain Payment Receipt
curl -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search \
  -H "Content-Type: application/json" \
  -H "X-Payment-Receipt: 0x...your_base_tx_hash..." \
  -d '{"query": "latest autonomous AI agent protocols 2026", "limit": 3}'
```

---

## 🤖 Model Context Protocol (MCP) Integration

Equip your AI Agents (Claude Desktop, Cursor, Antigravity, OpenDevin) with autonomous paid web scraping & search in one click:

### Claude Desktop / Cursor Config (`mcp.json`)

```json
{
  "mcpServers": {
    "x402-scraper": {
      "command": "npx",
      "args": ["-y", "@ami-guru/x402-scraper-engine"],
      "env": {
        "WORKER_URL": "https://x402-scraper-engine.gejoe-tt.workers.dev",
        "BASE_RPC_URL": "https://mainnet.base.org",
        "AGENT_PRIVATE_KEY": "0xYourAgentFundedPrivateKey"
      }
    }
  }
}
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Built by **[ASOT Marketing and Investment](https://getguruautomations.com)**.
