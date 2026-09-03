# ⚡ x402 Multi-Tier Agent Intelligence & Scraper Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Base L2](https://img.shields.io/badge/Settlement-Base%20L2-0052FF.svg)](https://base.org)
[![USDC](https://img.shields.io/badge/Currency-USDC%20on%20Base-2775CA.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![Cloudflare Workers AI](https://img.shields.io/badge/Edge%20LLM-Llama%203%208B-F38020.svg)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8A2BE2.svg)](https://modelcontextprotocol.io/)
[![x402 V2](https://img.shields.io/badge/Spec-x402%20V2%20%2B%20Bazaar-green.svg)](https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production Multi-Tiered Agent Intelligence & Context Compression API running natively on Base L2 USDC with HTTP 402 micro-settlement.**  
> Convert webpages into clean Markdown, synthesize token-dense Llama 3 digests, audit smart contracts/websites for security risks, or query Twitter sentiment with zero API subscriptions.

---

## 🌐 Live Production Endpoints

| Resource | URL | Method | Price (Base USDC) | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Health & Info** | `https://x402-scraper-engine.gejoe-tt.workers.dev/health` | `GET` | **Free** | Live engine status & pricing catalog |
| **Clean Scrape** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape` | `POST` | **0.005 USDC** | Zero-bloat HTML to Markdown extraction |
| **Edge LLM Digest** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/digest` | `POST` | **0.025 USDC** | Llama 3 Edge Context Synthesis & entity extraction |
| **Security Signal Audit** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/audit` | `POST` | **0.080 USDC** | Phishing, contract & credibility risk scoring |
| **Deep Web Search** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search` | `POST` | **0.050 USDC** | Multi-source web research & synthesized summaries |
| **Twitter Search** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/search` | `POST` | **0.050 USDC** | Cashtags (`$BASE`), sentiment & topics |
| **Twitter Profile** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/profile` | `POST` | **0.030 USDC** | Bio & recent tweets for any handle |
| **Bazaar Discovery** | `https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json` | `GET` | **Free** | x402 V2 + Bazaar machine discovery |
| **OpenAPI 3.1 Spec** | `https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json` | `GET` | **Free** | Full machine-readable schema |

---

## 💡 Why Multi-Tiered x402?

- **Zero Signups & No API Keys:** No credit cards, accounts, or monthly commitments.
- **Pay-Per-Call Micropayments:** $0.005 to $0.080 USDC on Base L2 instead of $50–$100/mo SaaS subscriptions.
- **Context Compression Savings:** `/v1/digest` saves 80%+ on downstream Claude/GPT-4o token bills by summarizing 10,000 words into a dense 300-word structured brief on the edge.
- **Crypto Agent Security:** `/v1/audit` provides instantaneous scam, drainer, and contract safety checks before agents execute transactions.
- **Bypasses X API Paywall:** Query real-time Twitter sentiment and profiles without the $100/mo fee.
- **x402 V2 + Bazaar Standard:** Compatible with automated agent marketplaces (Agentic.market, LangChain, Coinbase AgentKit).

---

## 🚀 Quickstart: cURL Examples

### 1. Scrape Webpage (0.005 USDC)
```bash
# Challenge request (returns HTTP 402 with PAYMENT-REQUIRED header)
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com"}'

# Resubmit with Base L2 Transaction Receipt
curl -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape \
  -H "Content-Type: application/json" \
  -H "X-Payment-Receipt: 0x...your_tx_hash..." \
  -d '{"url": "https://news.ycombinator.com"}'
```

### 2. Edge LLM Context Synthesis (0.025 USDC)
```bash
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/digest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.base.org", "focus": "smart contract deployment"}'
```

### 3. Website & Contract Security Audit (0.080 USDC)
```bash
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-dex.org", "contract_address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}'
```

---

## 🤖 Model Context Protocol (MCP) Configuration

Add the 6-tool suite to **Claude Desktop**, **Cursor**, **Windsurf**, or **ElizaOS**:

```json
{
  "mcpServers": {
    "x402-agent-intelligence": {
      "command": "node",
      "args": ["dist/client/mcp-server.js"],
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
MIT © 2026 ASOT Marketing and Investment
