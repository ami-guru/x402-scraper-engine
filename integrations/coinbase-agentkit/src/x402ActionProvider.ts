import { z } from "zod";
import {
  ScrapeWebpageSchema,
  DigestWebpageSchema,
  AuditWebpageSchema,
  SearchWebSchema,
  SearchTwitterSchema,
  GetTwitterProfileSchema
} from "./schemas.js";

export interface Network {
  protocolFamily: string;
  networkId?: string;
  chainId?: string | number;
}

export interface WalletProvider {
  getAddress?: () => Promise<string>;
  sendTransaction?: (tx: { to: string; data?: string; value?: bigint | string }) => Promise<string>;
  signTypedData?: (typedData: {
    domain: Record<string, any>;
    types: Record<string, any>;
    primaryType: string;
    message: Record<string, any>;
  }) => Promise<string>;
  [key: string]: any;
}

export interface Action<TActionSchema extends z.ZodSchema = z.ZodSchema> {
  name: string;
  description: string;
  schema: TActionSchema;
  invoke: (args: z.infer<TActionSchema>) => Promise<string>;
}

export interface X402ScraperConfig {
  workerUrl?: string;
  treasuryAddress?: string;
  network?: string;
}

const DEFAULT_WORKER_URL = "https://x402-scraper-engine.gejoe-tt.workers.dev";
const DEFAULT_TREASURY = "0x4107f297256E00F32873f45F50A35a902c1c2034";
const USDC_BASE_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Autonomous HTTP 402 Web Scraper & Intelligence Action Provider for Coinbase AgentKit.
 * Enables AI agents to scrape, digest, search, audit, and extract Twitter intelligence on Base L2.
 */
export class X402ScraperActionProvider {
  public readonly name = "x402_scraper";
  public readonly actionProviders: any[] = [];
  public readonly workerUrl: string;
  public readonly treasuryAddress: string;

  constructor(config: X402ScraperConfig = {}) {
    this.workerUrl = (config.workerUrl || DEFAULT_WORKER_URL).replace(/\/$/, "");
    this.treasuryAddress = config.treasuryAddress || DEFAULT_TREASURY;
  }

  /**
   * Verifies if the network is supported (Base Mainnet / EVM)
   */
  public supportsNetwork(network: Network): boolean {
    if (!network) return true;
    return network.protocolFamily === "evm";
  }

  /**
   * Executes HTTP request with dual-rail autonomous x402 payment handling (EIP-712 signature or direct receipt)
   */
  private async executeWithPayment(path: string, body: Record<string, any>, walletProvider?: WalletProvider): Promise<string> {
    const targetUrl = `${this.workerUrl}${path}`;

    // 1. First probe: consumes 2-call free trial grace tier if available
    try {
      const probeRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "agentkit-plugin-x402-scraper/1.4.1"
        },
        body: JSON.stringify(body)
      });

      if (probeRes.ok) {
        const data = await probeRes.json();
        return JSON.stringify(data, null, 2);
      }

      if (probeRes.status !== 402) {
        const errText = await probeRes.text();
        return JSON.stringify({ error: `Service returned HTTP ${probeRes.status}`, details: errText }, null, 2);
      }

      // 2. HTTP 402 Payment Required encountered
      const paymentReqHeader = probeRes.headers.get("payment-required") || probeRes.headers.get("PAYMENT-REQUIRED");
      let paymentRequirements: any = null;

      if (paymentReqHeader) {
        try {
          const rawStr = typeof atob === "function" ? atob(paymentReqHeader) : Buffer.from(paymentReqHeader, "base64").toString("utf-8");
          paymentRequirements = JSON.parse(rawStr);
        } catch {
          // ignore decode error
        }
      }

      if (!paymentRequirements) {
        try {
          paymentRequirements = await probeRes.json();
        } catch {
          // ignore
        }
      }

      const accepts = paymentRequirements?.accepts?.[0];
      const amountUnits = accepts?.amount || "5000";
      const recipient = accepts?.payTo || this.treasuryAddress;
      const assetContract = accepts?.asset || USDC_BASE_CONTRACT;

      // 3. Autonomous Payment Rail A: EIP-712 Gasless TransferWithAuthorization via Facilitator
      if (walletProvider && typeof walletProvider.signTypedData === "function" && typeof walletProvider.getAddress === "function") {
        try {
          const fromAddress = await walletProvider.getAddress();
          const now = Math.floor(Date.now() / 1000);
          const nonceBytes = new Uint8Array(32);
          if (typeof crypto !== "undefined" && crypto.getRandomValues) {
            crypto.getRandomValues(nonceBytes);
          } else {
            for (let i = 0; i < 32; i++) nonceBytes[i] = Math.floor(Math.random() * 256);
          }
          const nonce = "0x" + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, "0")).join("");

          const domain = {
            name: "USD Coin",
            version: "2",
            chainId: 8453,
            verifyingContract: assetContract
          };

          const types = {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" }
            ]
          };

          const message = {
            from: fromAddress,
            to: recipient,
            value: BigInt(amountUnits),
            validAfter: BigInt(now - 60),
            validBefore: BigInt(now + (accepts?.maxTimeoutSeconds || 3600)),
            nonce
          };

          const signature = await walletProvider.signTypedData({
            domain,
            types,
            primaryType: "TransferWithAuthorization",
            message
          });

          const paymentPayload = {
            x402Version: 2,
            scheme: "exact",
            network: accepts?.network || "eip155:8453",
            accepted: accepts || {
              scheme: "exact",
              network: "eip155:8453",
              amount: amountUnits,
              asset: assetContract,
              payTo: recipient,
              maxTimeoutSeconds: 3600
            },
            payload: {
              signature,
              authorization: {
                from: message.from,
                to: message.to,
                value: message.value.toString(),
                validAfter: message.validAfter.toString(),
                validBefore: message.validBefore.toString(),
                nonce: message.nonce
              }
            },
            extensions: paymentRequirements?.extensions || {}
          };

          const b64Signature = typeof btoa === "function"
            ? btoa(JSON.stringify(paymentPayload))
            : Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

          const resubmitRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "PAYMENT-SIGNATURE": b64Signature,
              "User-Agent": "agentkit-plugin-x402-scraper/1.4.1"
            },
            body: JSON.stringify(body)
          });

          if (resubmitRes.ok) {
            const paidData = await resubmitRes.json();
            return JSON.stringify(paidData, null, 2);
          }

          const failText = await resubmitRes.text();
          return JSON.stringify({ error: `EIP-712 settlement failed (Status ${resubmitRes.status})`, details: failText }, null, 2);
        } catch (sigErr: any) {
          // Fall through to Rail B if signTypedData fails
        }
      }

      // 4. Autonomous Payment Rail B: Direct On-Chain ERC-20 Transfer
      if (walletProvider && typeof walletProvider.sendTransaction === "function") {
        try {
          const hexAmount = BigInt(amountUnits).toString(16).padStart(64, "0");
          const cleanRecipient = recipient.toLowerCase().replace(/^0x/, "").padStart(64, "0");
          const transferData = `0xa9059cbb${cleanRecipient}${hexAmount}`;

          const txHash = await walletProvider.sendTransaction({
            to: assetContract,
            data: transferData
          });

          const receiptRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Payment-Receipt": txHash,
              "User-Agent": "agentkit-plugin-x402-scraper/1.4.1"
            },
            body: JSON.stringify(body)
          });

          if (receiptRes.ok) {
            const paidData = await receiptRes.json();
            return JSON.stringify(paidData, null, 2);
          }

          const receiptErr = await receiptRes.text();
          return JSON.stringify({ error: `Receipt verification failed (Status ${receiptRes.status})`, details: receiptErr }, null, 2);
        } catch (txErr: any) {
          return JSON.stringify({ error: `On-chain transfer failed: ${txErr.message}` }, null, 2);
        }
      }

      // 5. If no wallet or settlement could not be initiated
      return JSON.stringify({
        error: "HTTP 402 Payment Required",
        protocol: "x402",
        message: "Free trial calls exhausted. Payment required in USDC on Base (Chain ID 8453).",
        amount_units: amountUnits,
        recipient,
        asset_contract: assetContract,
        instruction: "Provide an EvmWalletProvider with Base L2 USDC balance for autonomous micropayment execution."
      }, null, 2);

    } catch (networkErr: any) {
      return JSON.stringify({ error: `Network error connecting to x402 engine: ${networkErr.message}` }, null, 2);
    }
  }

  /**
   * Returns all 6 AgentKit actions bound to the current wallet provider
   */
  public getActions(walletProvider?: WalletProvider): Action[] {
    return [
      {
        name: "scrape_webpage",
        description: "Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM analysis. Includes 2 free trial calls, then costs $0.005 USDC on Base L2.",
        schema: ScrapeWebpageSchema,
        invoke: async (args: z.infer<typeof ScrapeWebpageSchema>) => {
          return this.executeWithPayment("/v1/scrape", { url: args.url }, walletProvider);
        }
      },
      {
        name: "digest_webpage",
        description: "Extracts executive summary, key takeaways, and structured entities from any webpage using Edge Llama-3. Includes 2 free trial calls, then costs $0.025 USDC on Base L2.",
        schema: DigestWebpageSchema,
        invoke: async (args: z.infer<typeof DigestWebpageSchema>) => {
          return this.executeWithPayment("/v1/digest", { url: args.url, focus: args.focus || args.prompt }, walletProvider);
        }
      },
      {
        name: "audit_webpage",
        description: "Audits website security, phishing risks, credibility signals, and smart contract signals. Includes 2 free trial calls, then costs $0.080 USDC on Base L2.",
        schema: AuditWebpageSchema,
        invoke: async (args: z.infer<typeof AuditWebpageSchema>) => {
          return this.executeWithPayment("/v1/audit", { url: args.url }, walletProvider);
        }
      },
      {
        name: "search_web",
        description: "Searches the live web across multiple search engines and extracts synthesized clean Markdown. Includes 2 free trial calls, then costs $0.050 USDC on Base L2.",
        schema: SearchWebSchema,
        invoke: async (args: z.infer<typeof SearchWebSchema>) => {
          return this.executeWithPayment("/v1/search", { query: args.query, limit: args.limit || 5 }, walletProvider);
        }
      },
      {
        name: "search_twitter",
        description: "Searches Twitter/X for keywords, cashtags (e.g. $BASE, $ETH), sentiment, and recent tweets. Includes 2 free trial calls, then costs $0.050 USDC on Base L2.",
        schema: SearchTwitterSchema,
        invoke: async (args: z.infer<typeof SearchTwitterSchema>) => {
          return this.executeWithPayment("/v1/twitter/search", { query: args.query, limit: args.maxResults || 10 }, walletProvider);
        }
      },
      {
        name: "get_twitter_profile",
        description: "Fetches a Twitter/X user profile bio, followers count, verification status, and recent tweet timeline. Includes 2 free trial calls, then costs $0.030 USDC on Base L2.",
        schema: GetTwitterProfileSchema,
        invoke: async (args: z.infer<typeof GetTwitterProfileSchema>) => {
          return this.executeWithPayment("/v1/twitter/profile", { username: args.username }, walletProvider);
        }
      }
    ];
  }
}
