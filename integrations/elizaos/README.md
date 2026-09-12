# elizaos-plugin-x402-scraper

Autonomous HTTP 402 Web Scraper, Markdown extraction, and Edge Llama-3 synthesis plugin for [ElizaOS](https://github.com/elizaos/eliza) agents on Base L2.

## Features
- **Zero API Keys & Zero Setup**: No credentials, accounts, or pre-configured API keys needed.
- **2 Free Trial Calls**: Every agent gets 2 trial requests automatically before micropayment gating.
- **Base L2 Micropayments**: Native x402 pay-per-call microtransactions via Base USDC ($0.002 / call).
- **Clean Markdown Extraction**: Returns token-optimized Markdown ready for LLM consumption.

## Installation

```bash
npm install elizaos-plugin-x402-scraper
# or
bun add elizaos-plugin-x402-scraper
```

## Usage

```typescript
import { x402Plugin } from "elizaos-plugin-x402-scraper";

export default {
  // ... your agent configuration
  plugins: [x402Plugin],
};
```

## License
MIT
