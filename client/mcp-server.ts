import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  Hex,
  Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const AGENT_PRIVATE_KEY = (process.env.AGENT_PRIVATE_KEY || '').trim();
const DEFAULT_USDC_BASE: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Standard ERC-20 ABI snippet for transfer
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

class X402ScraperMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'x402-scraper-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'clean_web_scrape',
          description:
            'Scrapes any public webpage and returns clean, sanitized, token-efficient Markdown for LLM ingestion. Automatically handles HTTP 402 microtransactions (0.005 USDC on Base) if required.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The target webpage URL to scrape (must start with http:// or https://).'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'synthesize_web_digest',
          description:
            'Scrapes target webpage and executes Edge LLM (Llama 3) context synthesis to extract executive summary, key takeaways, and structured entities. Automatically handles HTTP 402 microtransactions (0.025 USDC on Base).',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The webpage URL to synthesize.'
              },
              focus: {
                type: 'string',
                description: 'Optional focus area or specific query for the synthesis.'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'audit_web_signal',
          description:
            'Performs security, credibility, and phishing risk analysis for any website or smart contract landing page. Returns credibility score (0-100) and risk signals. Automatically handles HTTP 402 microtransactions (0.080 USDC on Base).',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The webpage URL to audit for security signals.'
              },
              contract_address: {
                type: 'string',
                description: 'Optional 0x EVM smart contract address to verify alongside the web page.'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'clean_web_search',
          description:
            'Performs deep web research across multiple sources, extracting clean Markdown summaries from top results. Automatically handles HTTP 402 microtransactions (0.05 USDC on Base).',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The research search query to look up on the web.'
              },
              limit: {
                type: 'number',
                description: 'Max number of top pages to scrape into summaries (default: 3).'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'twitter_search',
          description:
            'Searches public tweets, cashtags ($BTC, $BASE), and sentiment across Twitter/X without the $100/mo API fee. Automatically handles HTTP 402 microtransactions (0.05 USDC on Base).',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Twitter search query, cashtag, or topic (e.g. "$BASE autonomous agents").'
              },
              limit: {
                type: 'number',
                description: 'Max number of tweets to extract (default: 5).'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'twitter_profile_lookup',
          description:
            'Extracts public Twitter/X profile bio and recent tweets for any username without the $100/mo API fee. Automatically handles HTTP 402 microtransactions (0.03 USDC on Base).',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'The Twitter handle/username to look up (e.g. "jessepollak").'
              }
            },
            required: ['username']
          }
        }
      ]
    }));

    // Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;

      if (toolName === 'clean_web_scrape') {
        const args = request.params.arguments as { url?: string };
        if (!args || !args.url) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "url" parameter.');
        }

        try {
          const result = await this.executeScrapeWithAutoPayment(args.url);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Scrape Error: ${error.message}` }] };
        }
      }

      if (toolName === 'synthesize_web_digest') {
        const args = request.params.arguments as { url?: string; focus?: string };
        if (!args || !args.url) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "url" parameter.');
        }

        try {
          const result = await this.executeDigestWithAutoPayment(args.url, args.focus);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Digest Error: ${error.message}` }] };
        }
      }

      if (toolName === 'audit_web_signal') {
        const args = request.params.arguments as { url?: string; contract_address?: string };
        if (!args || !args.url) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "url" parameter.');
        }

        try {
          const result = await this.executeAuditWithAutoPayment(args.url, args.contract_address);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Audit Error: ${error.message}` }] };
        }
      }

      if (toolName === 'clean_web_search') {
        const args = request.params.arguments as { query?: string; limit?: number };
        if (!args || !args.query) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "query" parameter.');
        }

        try {
          const result = await this.executeSearchWithAutoPayment(args.query, args.limit || 3);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Search Error: ${error.message}` }] };
        }
      }

      if (toolName === 'twitter_search') {
        const args = request.params.arguments as { query?: string; limit?: number };
        if (!args || !args.query) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "query" parameter.');
        }

        try {
          const result = await this.executeTwitterSearchWithAutoPayment(args.query, args.limit || 5);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Twitter Search Error: ${error.message}` }] };
        }
      }

      if (toolName === 'twitter_profile_lookup') {
        const args = request.params.arguments as { username?: string };
        if (!args || !args.username) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing "username" parameter.');
        }

        try {
          const result = await this.executeTwitterProfileWithAutoPayment(args.username);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: `Twitter Profile Error: ${error.message}` }] };
        }
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    });
  }

  /**
   * Performs the scrape request, intercepting 402 Payment Required and auto-settling on Base
   */
  private async executeScrapeWithAutoPayment(targetUrl: string): Promise<string> {
    const scrapeEndpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/scrape`;

    // 1. Initial Attempt (without receipt)
    let initialRes = await fetch(scrapeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl })
    });

    // If already successful (e.g. free tier or cached), return result
    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return formatMarkdownOutput(data);
    }

    // 2. Handle HTTP 402 Payment Required
    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.002';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error(
          'HTTP 402 received, but treasury recipient address is not properly configured on worker.'
        );
      }

      // Check agent private key
      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Service charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to enable autonomous microtransactions.`
        );
      }

      // 3. Execute On-Chain Microtransaction via viem
      const txHash = await this.sendUsdcPayment(
        recipient as Address,
        amount,
        tokenAddress
      );

      // 4. Resubmit Request with Payment Receipt
      const paidRes = await fetch(scrapeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ url: targetUrl })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(
          `Payment submitted (${txHash}), but worker returned HTTP ${paidRes.status}: ${
            errorBody.details || errorBody.message || errorBody.error || paidRes.statusText
          }`
        );
      }

      const finalData: any = await paidRes.json();
      return formatMarkdownOutput(finalData);
    }

    // Other HTTP Error
    const errText = await initialRes.text();
    throw new Error(`Scraper returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Performs Edge LLM context synthesis, auto-settling 0.025 USDC on Base if 402 is returned
   */
  private async executeDigestWithAutoPayment(targetUrl: string, focus?: string): Promise<string> {
    const digestEndpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/digest`;

    let initialRes = await fetch(digestEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, focus })
    });

    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return formatMarkdownOutput(data);
    }

    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.025';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error('HTTP 402 received, but treasury address is not configured on worker.');
      }

      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Edge LLM digest charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to proceed.`
        );
      }

      const txHash = await this.sendUsdcPayment(recipient as Address, amount, tokenAddress);

      const paidRes = await fetch(digestEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ url: targetUrl, focus })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(`Digest failed after payment (${txHash}): ${errorBody.details || errorBody.error || paidRes.statusText}`);
      }

      const paidData: any = await paidRes.json();
      return formatMarkdownOutput(paidData);
    }

    const errText = await initialRes.text();
    throw new Error(`Digest endpoint returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Performs Security and Credibility Audit, auto-settling 0.080 USDC on Base if 402 is returned
   */
  private async executeAuditWithAutoPayment(targetUrl: string, contractAddress?: string): Promise<string> {
    const auditEndpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/audit`;

    let initialRes = await fetch(auditEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, contract_address: contractAddress })
    });

    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return formatMarkdownOutput(data);
    }

    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.080';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error('HTTP 402 received, but treasury address is not configured on worker.');
      }

      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Security audit charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to proceed.`
        );
      }

      const txHash = await this.sendUsdcPayment(recipient as Address, amount, tokenAddress);

      const paidRes = await fetch(auditEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ url: targetUrl, contract_address: contractAddress })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(`Security audit failed after payment (${txHash}): ${errorBody.details || errorBody.error || paidRes.statusText}`);
      }

      const paidData: any = await paidRes.json();
      return formatMarkdownOutput(paidData);
    }

    const errText = await initialRes.text();
    throw new Error(`Audit endpoint returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Performs web search and deep scrape, auto-settling 0.05 USDC on Base if 402 is returned
   */
  private async executeSearchWithAutoPayment(query: string, limit: number): Promise<string> {
    const searchEndpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/search`;

    // 1. Initial Attempt
    let initialRes = await fetch(searchEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });

    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return formatSearchResultsOutput(data);
    }

    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.05';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error('HTTP 402 received, but treasury address is not configured on worker.');
      }

      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Deep search charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to proceed.`
        );
      }

      // Execute 0.05 USDC payment on Base
      const txHash = await this.sendUsdcPayment(recipient as Address, amount, tokenAddress);

      // Resubmit request with payment receipt
      const paidRes = await fetch(searchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ query, limit })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(
          `Payment submitted (${txHash}), but worker returned HTTP ${paidRes.status}: ${
            errorBody.details || errorBody.message || errorBody.error || paidRes.statusText
          }`
        );
      }

      const finalData: any = await paidRes.json();
      return formatSearchResultsOutput(finalData);
    }

    const errText = await initialRes.text();
    throw new Error(`Search returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Performs Twitter search and deep extraction, auto-settling 0.05 USDC on Base if 402 is returned
   */
  private async executeTwitterSearchWithAutoPayment(query: string, limit: number): Promise<string> {
    const endpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/twitter/search`;

    let initialRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });

    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return data.markdown || JSON.stringify(data, null, 2);
    }

    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.05';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error('HTTP 402 received, but treasury address is not configured on worker.');
      }

      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Twitter search charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to proceed.`
        );
      }

      const txHash = await this.sendUsdcPayment(recipient as Address, amount, tokenAddress);

      const paidRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ query, limit })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(
          `Payment submitted (${txHash}), but worker returned HTTP ${paidRes.status}: ${
            errorBody.details || errorBody.message || errorBody.error || paidRes.statusText
          }`
        );
      }

      const finalData: any = await paidRes.json();
      return finalData.markdown || JSON.stringify(finalData, null, 2);
    }

    const errText = await initialRes.text();
    throw new Error(`Twitter search returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Performs Twitter profile lookup, auto-settling 0.03 USDC on Base if 402 is returned
   */
  private async executeTwitterProfileWithAutoPayment(username: string): Promise<string> {
    const endpoint = `${WORKER_URL.replace(/\/$/, '')}/v1/twitter/profile`;

    let initialRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (initialRes.status === 200) {
      const data: any = await initialRes.json();
      return data.markdown || JSON.stringify(data, null, 2);
    }

    if (initialRes.status === 402) {
      const paymentData: any = await initialRes.json().catch(() => ({}));
      const recipient =
        initialRes.headers.get('X-Payment-To') ||
        paymentData.payment?.recipient ||
        process.env.TREASURY_WALLET_ADDRESS;
      const amount = initialRes.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.03';
      const tokenAddress: Address =
        (initialRes.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
        throw new Error('HTTP 402 received, but treasury address is not configured on worker.');
      }

      if (!AGENT_PRIVATE_KEY || AGENT_PRIVATE_KEY.startsWith('0x000000000000')) {
        throw new Error(
          `HTTP 402 Payment Required: Twitter profile lookup charges ${amount} USDC on Base.\n` +
          `Recipient: ${recipient}\n` +
          `Please configure a funded AGENT_PRIVATE_KEY in .env to proceed.`
        );
      }

      const txHash = await this.sendUsdcPayment(recipient as Address, amount, tokenAddress);

      const paidRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify({ username })
      });

      if (!paidRes.ok) {
        const errorBody: any = await paidRes.json().catch(() => ({}));
        throw new Error(
          `Payment submitted (${txHash}), but worker returned HTTP ${paidRes.status}: ${
            errorBody.details || errorBody.message || errorBody.error || paidRes.statusText
          }`
        );
      }

      const finalData: any = await paidRes.json();
      return finalData.markdown || JSON.stringify(finalData, null, 2);
    }

    const errText = await initialRes.text();
    throw new Error(`Twitter profile lookup returned HTTP ${initialRes.status}: ${errText}`);
  }

  /**
   * Signs and broadcasts USDC transfer on Base
   */
  private async sendUsdcPayment(
    recipient: Address,
    amountUsdc: string,
    tokenAddress: Address
  ): Promise<string> {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY as Hex);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL)
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL)
    });

    // USDC has 6 decimals on Base
    const parsedAmount = parseUnits(amountUsdc, 6);

    // Broadcast ERC-20 transfer transaction
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipient, parsedAmount]
    });

    // Wait for 1 confirmation
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    return hash;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('x402 Scraper MCP Server running on stdio');
  }
}

function formatMarkdownOutput(data: any): string {
  let header = '';
  if (data.title) {
    header += `# ${data.title}\n\n`;
  }
  header += `> **Source URL:** [${data.url}](${data.url})\n`;
  header += `> **Estimated Tokens:** ${data.tokens_estimated || 'N/A'}\n`;
  if (data.payment?.tx_hash) {
    header += `> **Settlement Proof (Base L2):** [${data.payment.tx_hash}](https://basescan.org/tx/${data.payment.tx_hash}) (${data.payment.amount} ${data.payment.asset})\n`;
  }
  header += `\n---\n\n`;

  return `${header}${data.markdown}`;
}

function formatSearchResultsOutput(data: any): string {
  let header = `# Deep Research: ${data.query}\n\n`;
  header += `> **Results Count:** ${data.results?.length || 0}\n`;
  header += `> **Estimated Tokens:** ${data.tokens_estimated || 'N/A'}\n`;
  if (data.payment?.tx_hash) {
    header += `> **Settlement Proof (Base L2):** [${data.payment.tx_hash}](https://basescan.org/tx/${data.payment.tx_hash}) (${data.payment.amount} ${data.payment.asset})\n`;
  }
  header += `\n---\n\n`;

  let body = '';
  for (const item of data.results || []) {
    body += `### [${item.title}](${item.url})\n`;
    body += `> **URL:** ${item.url}\n\n`;
    if (item.snippet) {
      body += `**Snippet:** ${item.snippet}\n\n`;
    }
    if (item.markdownSummary) {
      body += `**Extracted Summary:**\n\n${item.markdownSummary}\n\n`;
    }
    body += `---\n\n`;
  }

  return `${header}${body}`;
}

const server = new X402ScraperMcpServer();
server.run().catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});
