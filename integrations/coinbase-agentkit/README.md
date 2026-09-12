# agentkit-plugin-x402-scraper

[![npm version](https://img.shields.io/npm/v/agentkit-plugin-x402-scraper.svg)](https://www.npmjs.com/package/agentkit-plugin-x402-scraper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Network: Base](https://img.shields.io/badge/Network-Base%20(8453)-blue.svg)](https://base.org)
[![Currency: USDC](https://img.shields.io/badge/Currency-USDC-green.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

Autonomous **HTTP 402 Web Scraper, Edge Llama-3 Digest, Security Audit & Twitter Intelligence Action Provider** for [Coinbase AgentKit](https://github.com/coinbase/agentkit) on **Base L2**.

Equip your on-chain autonomous AI agents with the ability to scrape web pages into clean Markdown, synthesize executive digests, conduct security audits, search the live web, and extract real-time Twitter/X sentiment—all settled autonomously via micropayments in Base USDC.

---

## ⚡ Features

- 🆓 **2-Call Free Trial Tier**: Every action includes 2 complimentary test calls with zero payment setup required.
- ⚡ **Dual-Rail Autonomous Settlement**:
  - **Rail A (Primary)**: Gasless EIP-712 `TransferWithAuthorization` signature via PayAI facilitator (zero ETH gas required from agent wallet).
  - **Rail B (Fallback)**: Direct on-chain ERC-20 USDC transfer receipt (`X-Payment-Receipt`).
- 🤖 **Native Coinbase AgentKit Action Provider**: Fully conforms to the Coinbase AgentKit Action Provider specification (`getActions`, `supportsNetwork`).
- 🔗 **Full Agent Framework Support**: Drop-in compatible with LangChain, LlamaIndex, and Vercel AI SDK through AgentKit adapters.
- 🚫 **Zero API Keys**: No monthly SaaS subscriptions, credit cards, or centralized rate limits.

---

## 📦 Installation

```bash
npm install agentkit-plugin-x402-scraper @coinbase/agentkit zod
```

---

## 🚀 Quick Start

### 1. Basic AgentKit Usage

```typescript
import { AgentKit, EvmWalletProvider } from "@coinbase/agentkit";
import { x402ScraperActionProvider } from "agentkit-plugin-x402-scraper";

// Initialize your Base EVM wallet provider
const walletProvider = new EvmWalletProvider({
  privateKey: process.env.BASE_PRIVATE_KEY
});

// Initialize AgentKit with the x402 Scraper Action Provider
const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    x402ScraperActionProvider()
  ]
});

// Tools are now available to your agent!
const actions = agentKit.getActions();
console.log(`Loaded ${actions.length} tools for autonomous execution.`);
```

### 2. With LangChain (`@coinbase/agentkit-langchain`)

```typescript
import { AgentKit, EvmWalletProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { x402ScraperActionProvider } from "agentkit-plugin-x402-scraper";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const walletProvider = new EvmWalletProvider({
  privateKey: process.env.BASE_PRIVATE_KEY
});

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [x402ScraperActionProvider()]
});

const tools = await getLangChainTools(agentKit);
const llm = new ChatOpenAI({ model: "gpt-4o" });

const agent = createReactAgent({
  llm,
  tools
});

const response = await agent.invoke({
  messages: [{ role: "user", content: "Scrape https://base.org and summarize its mission." }]
});

console.log(response.messages[response.messages.length - 1].content);
```

---

## 🛠️ Available Actions (6 Tools)

| Action Name | Description | Base Pricing (USDC) |
|---|---|---|
| `scrape_webpage` | Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM prompts. | **$0.005** (5,000 units) |
| `digest_webpage` | Extracts executive summaries, key takeaways, and structured entities via Edge Llama-3. | **$0.025** (25,000 units) |
| `audit_webpage` | Audits website security, phishing risks, credibility signals, and smart contract signals. | **$0.080** (80,000 units) |
| `search_web` | Searches the live web across multiple engines and extracts synthesized clean Markdown. | **$0.050** (50,000 units) |
| `search_twitter` | Searches Twitter/X for keywords, cashtags (e.g. `$BASE`), sentiment, and recent tweets. | **$0.050** (50,000 units) |
| `get_twitter_profile` | Fetches a Twitter/X user profile bio, followers count, verification, and recent timeline. | **$0.030** (30,000 units) |

*All actions include 2 free trial requests before HTTP 402 micro-settlement is enforced.*

---

## ⚙️ Configuration Options

You can customize the endpoint and treasury address by passing an optional configuration object:

```typescript
import { x402ScraperActionProvider } from "agentkit-plugin-x402-scraper";

const provider = x402ScraperActionProvider({
  workerUrl: "https://x402-scraper-engine.gejoe-tt.workers.dev", // Default Cloudflare Worker URL
  treasuryAddress: "0x4107f297256E00F32873f45F50A35a902c1c2034" // Default Base L2 USDC treasury
});
```

---

## 💳 Settlement Protocol Details

When the 2 free trial calls expire, the engine returns `HTTP 402 Payment Required` along with standard `PAYMENT-REQUIRED` (x402 v2 Bazaar extension) headers:

- **Network**: `eip155:8453` (Base Mainnet)
- **Token Contract**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC)
- **Primary Settlement**: EIP-712 `TransferWithAuthorization` signed by the agent's wallet and submitted in the `PAYMENT-SIGNATURE` header. Settle gaslessly via the PayAI facilitator on Base.
- **Fallback Settlement**: On-chain ERC-20 `transfer()` transaction hash submitted in the `X-Payment-Receipt` header.

---

## 📄 License

MIT License. Developed by **ASOT Marketing and Investment** (<ops@getguruautomations.com>).
