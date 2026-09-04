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

const DEFAULT_USDC_BASE: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_WORKER_URL = 'https://x402-scraper-engine.gejoe-tt.workers.dev';
const DEFAULT_RPC_URL = 'https://mainnet.base.org';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

export interface X402ClientConfig {
  privateKey?: string;
  workerUrl?: string;
  rpcUrl?: string;
}

export interface ScrapeResponse {
  url: string;
  title: string;
  markdown: string;
  wordCount: number;
  extractedAt: string;
}

export interface DigestResponse {
  url: string;
  title: string;
  executiveSummary: string;
  keyInsights: string[];
  entities: {
    people: string[];
    organizations: string[];
    topics: string[];
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  tokensSavedEstimate: number;
}

export interface AuditResponse {
  url: string;
  safetyScore: number;
  threatLevel: 'SAFE' | 'LOW_RISK' | 'SUSPICIOUS' | 'CRITICAL_THREAT';
  findings: string[];
  recommendation: string;
}

export interface SearchResponse {
  query: string;
  totalResults: number;
  synthesizedBrief: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

export interface TwitterSearchResponse {
  query: string;
  tweetCount: number;
  sentimentScore: number;
  sentimentSummary: string;
  tweets: Array<{ id: string; text: string; author: string; createdAt: string; likes: number; retweets: number }>;
}

export interface TwitterProfileResponse {
  username: string;
  name: string;
  bio: string;
  followersCount: number;
  verified: boolean;
  recentTweets: string[];
}

export class X402Client {
  private workerUrl: string;
  private rpcUrl: string;
  private privateKey?: string;

  constructor(config: X402ClientConfig = {}) {
    this.workerUrl = (config.workerUrl || DEFAULT_WORKER_URL).replace(/\/$/, '');
    this.rpcUrl = config.rpcUrl || DEFAULT_RPC_URL;
    this.privateKey = config.privateKey;
  }

  private async sendUsdcPayment(
    recipient: Address,
    amountUsdc: string,
    tokenAddress: Address = DEFAULT_USDC_BASE
  ): Promise<string> {
    if (!this.privateKey) {
      throw new Error('HTTP 402: No privateKey configured on X402Client to sign Base USDC payment.');
    }

    const formattedKey = (this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`) as Hex;
    const account = privateKeyToAccount(formattedKey);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(this.rpcUrl)
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(this.rpcUrl)
    });

    const parsedAmount = parseUnits(amountUsdc, 6);

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipient, parsedAmount]
    });

    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    return hash;
  }

  private async payAndExecute<T>(endpoint: string, body: Record<string, any>): Promise<T> {
    const targetUrl = `${this.workerUrl}${endpoint}`;

    // Step 1: Probe request
    let res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    if (res.status === 402) {
      const paymentData: any = await res.json().catch(() => ({}));
      const recipient: Address =
        (res.headers.get('X-Payment-To') as Address) ||
        (paymentData.payment?.recipient as Address) ||
        '0x4107f297256E00F32873f45F50A35a902c1c2034';
      const amount = res.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.005';
      const tokenAddress: Address =
        (res.headers.get('X-Payment-Asset-Address') as Address) ||
        (paymentData.payment?.contractAddress as Address) ||
        DEFAULT_USDC_BASE;

      // Step 2: Auto-settle on Base L2 USDC
      const txHash = await this.sendUsdcPayment(recipient, amount, tokenAddress);

      // Step 3: Resubmit with transaction receipt
      res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Receipt': txHash
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errBody: any = await res.json().catch(() => ({}));
        throw new Error(`Request failed after payment (${res.status}): ${errBody.message || JSON.stringify(errBody)}`);
      }

      return (await res.json()) as T;
    }

    const errText = await res.text();
    throw new Error(`Request failed (${res.status}): ${errText}`);
  }

  /**
   * Scrapes any public webpage and returns clean, sanitized Markdown (0.005 USDC)
   */
  async scrape(url: string): Promise<ScrapeResponse> {
    return this.payAndExecute<ScrapeResponse>('/v1/scrape', { url });
  }

  /**
   * Synthesizes webpage content using Edge Llama 3 context compression (0.025 USDC)
   */
  async digest(url: string, focus?: string): Promise<DigestResponse> {
    return this.payAndExecute<DigestResponse>('/v1/digest', { url, focus });
  }

  /**
   * Performs real-time security, phishing, and smart contract audit on a domain (0.080 USDC)
   */
  async audit(url: string, contractAddress?: string): Promise<AuditResponse> {
    return this.payAndExecute<AuditResponse>('/v1/audit', { url, contract_address: contractAddress });
  }

  /**
   * Performs multi-source deep web search and synthesized research brief (0.050 USDC)
   */
  async search(query: string, limit: number = 3): Promise<SearchResponse> {
    return this.payAndExecute<SearchResponse>('/v1/search', { query, limit });
  }

  /**
   * Searches real-time Twitter/X sentiment and cashtags ($BTC, $BASE) without the $100/mo API fee (0.050 USDC)
   */
  async searchTwitter(query: string, limit: number = 5): Promise<TwitterSearchResponse> {
    return this.payAndExecute<TwitterSearchResponse>('/v1/twitter/search', { query, limit });
  }

  /**
   * Fetches public Twitter profile and recent tweets without the $100/mo API fee (0.030 USDC)
   */
  async getTwitterProfile(username: string): Promise<TwitterProfileResponse> {
    return this.payAndExecute<TwitterProfileResponse>('/v1/twitter/profile', { username });
  }
}
