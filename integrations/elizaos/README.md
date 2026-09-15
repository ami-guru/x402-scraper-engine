# elizaos-plugin-x402-scraper

Autonomous HTTP 402 Web Scraper and Markdown Extraction Plugin for [ElizaOS](https://github.com/elizaos/eliza) agents on Base L2.

Provides pay-per-call web extraction with token-efficient Markdown output, structured action parameters, 2-call free trial grace tier, and dual-rail Base USDC on-chain micropayment verification.

## Features
- **Zero API Keys & Zero Signups**: Direct on-chain settlement; no third-party accounts or centralized API tokens needed.
- **2-Call Free Grace Tier**: Automatically allows 2 free trial requests per agent before payment challenge.
- **Base L2 Micropayments**: Native HTTP 402 pay-per-call settlement via USDC on Base ($0.005 / scrape).
- **Dual-Rail Settlement**: Supports autonomous EIP-712 gasless `TransferWithAuthorization` signatures or direct ERC-20 transaction hashes via `X-Payment-Receipt`.
- **Clean Markdown Extraction**: Strips scripts, ads, base64 images, and layout clutter into token-efficient Markdown for LLM analysis.
- **ElizaOS Compliant**: Declares explicit action parameters (`url`, `receipt`), returns structured result objects, and awaits all callbacks.

## Installation

```bash
npm install elizaos-plugin-x402-scraper
# or
bun add elizaos-plugin-x402-scraper
```

## Action: `X402_SCRAPE`

### Parameters
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | The public HTTP or HTTPS URL to scrape and convert to Markdown. |
| `receipt` | `string` | No | Optional on-chain Base USDC transaction hash (Chain ID: 8453). |

### Agent Usage

```typescript
import { x402Plugin } from "elizaos-plugin-x402-scraper";

export default {
  // ... agent runtime configuration
  plugins: [x402Plugin],
};
```

### Prompt Examples
- *"Can you scrape https://news.ycombinator.com and summarize the top headlines?"*
- *"Scrape https://docs.base.org/using-base using payment receipt 0x9f1a2b3c4d5e6f..."*

## License
MIT
