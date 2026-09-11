# Coinbase AgentKit Integration for x402 Scraper Engine

Add autonomous web scraping, Llama-3 context digests, and Twitter intelligence to any **Coinbase AgentKit** agent on Base L2.

## Features
- **2-Call Free Grace Tier**: Test scraping immediately with zero configuration.
- **Autonomous Microtransactions**: Agent signs 0.005 USDC transfers directly from its on-chain Base wallet upon encountering HTTP 402.
- **Zero API Keys**: No monthly SaaS subscriptions, credit cards, or rate limit bottlenecks.

## Usage

```typescript
import { AgentKit, EvmWalletProvider } from "@coinbase/agentkit";
import { X402ScraperActionProvider } from "./x402ActionProvider";

// 1. Initialize your Base EVM wallet provider
const walletProvider = new EvmWalletProvider({
  privateKey: process.env.BASE_PRIVATE_KEY
});

// 2. Initialize AgentKit with the x402 Scraper Action Provider
const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    new X402ScraperActionProvider()
  ]
});

// 3. Your agent can now autonomously scrape any URL!
// Tools exposed: clean_web_scrape, synthesize_web_digest, twitter_search
```
