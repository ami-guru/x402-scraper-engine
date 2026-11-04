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
| **1-Tap Terminal Read** | `https://x402-scraper-engine.gejoe-tt.workers.dev/read/:url` | `GET` | **0.005 USDC** *(2 calls free/IP)* | Zero-setup instant Markdown extraction via curl |
| **Clean Scrape** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape` | `POST` | **0.005 USDC** | Zero-bloat HTML to Markdown extraction |
| **Recursive Doc Crawl** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/crawl` | `POST` | **0.250 USDC** | Recursive documentation tree crawler (up to 25 pages) |
| **PDF Stream Parser** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/pdf` | `POST` | **0.050 USDC** | Multi-page whitepaper & academic PDF stream extraction |
| **Structured JSON** | `https://x402-scraper-engine.gejoe-tt.workers.dev/v1/extract` | `POST` | **0.030 USDC** | Schema-validated structured JSON via Edge Llama 3 |
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

### 1. Instant 1-Tap Terminal Read (2 calls free per IP, then 0.005 USDC)
```bash
# Direct terminal extraction - zero JSON or headers required
curl https://x402-scraper-engine.gejoe-tt.workers.dev/read/https://news.ycombinator.com
```

### 2. Recursive Documentation Crawler (0.250 USDC)
```bash
# Crawls documentation trees (up to 25 pages) into unified Table-of-Contents Markdown
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://react.dev", "maxPages": 15}'
```

### 3. Whitepaper & Academic PDF Stream (0.050 USDC)
```bash
# Extracts clean Markdown directly from edge V8 isolate in ~1.4s
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/pdf \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bitcoin.org/bitcoin.pdf"}'
```

### 4. Clean Webpage Scrape (0.005 USDC)
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

### 5. Edge LLM Context Synthesis (0.025 USDC)
```bash
curl -i -X POST https://x402-scraper-engine.gejoe-tt.workers.dev/v1/digest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.base.org", "focus": "smart contract deployment"}'
```

---

## 🛡️ Ecosystem Security Integration: BountyHunter AI

Autonomous agents consuming external web links should always verify payload safety before injecting text into LLM prompts. We recommend routing pre-flight URL risk checks through our Base L2 partner **[BountyHunter AI (@dextermos-dev)](https://github.com/dextermos-dev)**:

* **Endpoint**: `POST https://tea-airplane-trunk-define.trycloudflare.com/api/v1/shield/url`
* **Price**: `0.50 USDC` (RFC-x402 on Base L2)
* **Settlement**: Canonical USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) to Settlement Wallet `0x8366bCe3a2D379De7656D7A67015789FaF999f20`.
* **Capability**: Real-time detection of prompt injections, malicious payloads, and phishing links in target web content.

---

## 🤖 Model Context Protocol (MCP) Configuration

Add the 6-tool suite to **Claude Desktop**, **Cursor**, **Windsurf**, or **ElizaOS**:

```json
{
  "mcpServers": {
    "x402-agent-intelligence": {
      "command": "npx",
      "args": ["-y", "github:ami-guru/x402-scraper-engine"],
      "env": {
        "BASE_RPC_URL": "https://mainnet.base.org",
        "AGENT_PRIVATE_KEY": "0xYourAgentFundedPrivateKey"
      }
    }
  }
}
```

---

## ⚡ Autonomous Agent TypeScript SDK (3 Lines of Code)

Import into any **Coinbase AgentKit**, **ElizaOS**, **LangChain**, or custom bot:

```typescript
import { X402Client } from 'x402-scraper-engine/client';

const agentClient = new X402Client({
  privateKey: process.env.AGENT_PRIVATE_KEY, // Base L2 wallet
  rpcUrl: 'https://mainnet.base.org'
});

// 1. Scrape webpage to clean Markdown (0.005 USDC)
const page = await agentClient.scrape('https://news.ycombinator.com');

// 2. Synthesize token-dense context with Edge Llama 3 (0.025 USDC)
const digest = await agentClient.digest('https://docs.base.org', 'deployment');

// 3. Search real-time Twitter/X sentiment without $100/mo API fee (0.050 USDC)
const tweets = await agentClient.searchTwitter('$BASE');

// 4. Security & Phishing audit for DeFi sites (0.080 USDC)
const security = await agentClient.audit('https://suspicious-dex.com');
```

---

## 📄 License
MIT © 2026 ASOT Marketing and Investment
