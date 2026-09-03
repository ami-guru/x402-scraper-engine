# ⚡ x402 Scraper, Deep Search & Twitter Intelligence Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Base L2](https://img.shields.io/badge/Settlement-Base%20L2-0052FF.svg)](https://base.org)
[![USDC](https://img.shields.io/badge/Currency-USDC%20on%20Base-2775CA.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare%20Workers-F38020.svg)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8A2BE2.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production HTTP 402 Web3 Microtransaction Scraper, Deep Search & Twitter/X Intelligence Tool on Base L2.**  
> Convert any webpage into clean Markdown, conduct multi-source web research, or query Twitter sentiment and profiles with instant, permissionless on-chain micro-billing.

---

## 🌐 Live Production Endpoints

| Resource | URL | Method | Price | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Health & Discovery** | `https://x402-scraper-engine.gejoe-tt.workers.dev/health` | `GET` | **Free** | Service status & pricing manifest |
| **Clean Scrape** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape` | `POST` | **$0.02 USDC** | Scrape URL to token-efficient Markdown |
| **Deep Search** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search` | `POST` | **$0.05 USDC** | Multi-source web search & deep extraction |
| **Twitter Search** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/search` | `POST` | **$0.05 USDC** | Cashtags (`$BASE`), topics & sentiment |
| **Twitter Profile** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/profile` | `POST` | **$0.03 USDC** | Bio & recent tweets for any handle |
| **OpenAPI 3.1 Spec** | `https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json` | `GET` | **Free** | Machine-readable API schema |
| **x402 Protocol Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json` | `GET` | **Free** | Autonomous payment discovery |
| **AI Plugin Manifest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/ai-plugin.json` | `GET` | **Free** | GPTs / AgentKit manifest |

---

## 💡 Why x402 Engine?

- **Zero Signups & No API Keys:** No credit cards, accounts, or dashboard provisioning.
- **Pay-Per-Call Micropayments:** $0.02 to $0.05 USDC on Base L2 instead of $50–$100/mo subscriptions.
- **Bypasses X API Paywall:** Zero $100/mo fees for AI agents needing Twitter/X sentiment and profiles.
- **AI-Optimized Markdown:** Strips `<script>`, `<style>`, `<svg>`, comments, ads, navbars, and base64 bloat. Delivers clean, token-minimized Markdown (~80% token savings).
- **Native MCP Support:** Drop-in `clean_web_scrape`, `clean_web_search`, `twitter_search`, and `twitter_profile_lookup` tools for Claude Desktop, Cursor, Antigravity, ElizaOS, and Base AgentKit.
- **Cryptographic Settlement:** Settles in ~2 seconds on Base with 24-hour KV replay protection.

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

### 2. Twitter / X Cashtag & Sentiment Search ($0.05 USDC)

```bash
# Search $BASE or AI agent topics on Twitter
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/search \
  -H "Content-Type: application/json" \
  -d '{"query": "$BASE autonomous agents", "limit": 5}'
```

### 3. Twitter / X User Profile Lookup ($0.03 USDC)

```bash
# Extract bio and recent tweets for any handle
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/profile \
  -H "Content-Type: application/json" \
  -d '{"username": "jessepollak"}'
```

---

## 🤖 Model Context Protocol (MCP) Integration

Equip your AI Agents (Claude Desktop, Cursor, Antigravity, ElizaOS) in one click:

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
