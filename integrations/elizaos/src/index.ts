/**
 * elizaos-plugin-x402-scraper
 * Autonomous HTTP 402 Web Scraper and Markdown Extraction Plugin for ElizaOS agents on Base L2.
 * Supports dual-rail micropayments (EIP-712 signature & direct on-chain receipt) with a 2-call free trial grace tier.
 *
 * @author ASOT Marketing and Investment <ops@getguruautomations.com>
 * @license MIT
 */

export interface ActionParameter {
  name: string;
  description: string;
  required?: boolean;
  schema: {
    type: string;
    [key: string]: unknown;
  };
}

export interface ActionExample {
  user: string;
  content: {
    text: string;
    action?: string;
    url?: string;
    receipt?: string;
    [key: string]: unknown;
  };
}

export interface Action {
  name: string;
  similes: string[];
  description: string;
  parameters?: ActionParameter[];
  validate: (runtime: any, message: any, state?: any) => Promise<boolean>;
  handler: (
    runtime: any,
    message: any,
    state?: any,
    options?: Record<string, any>,
    callback?: (response: any) => Promise<any> | any
  ) => Promise<any>;
  examples: ActionExample[][];
}

export interface Plugin {
  name: string;
  description: string;
  actions: Action[];
  evaluators: any[];
  providers: any[];
}

const DEFAULT_WORKER_URL = "https://x402-scraper-engine.gejoe-tt.workers.dev";
const DEFAULT_TREASURY = "0x4107f297256E00F32873f45F50A35a902c1c2034";
const USDC_BASE_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const x402ScraperAction: Action = {
  name: "X402_SCRAPE",
  similes: ["SCRAPE_WEB", "EXTRACT_MARKDOWN", "READ_PAGE", "FETCH_URL", "X402_WEB_SCRAPE"],
  description: "Scrapes any public webpage and extracts clean, token-efficient Markdown for agent analysis. Features 2 free trial calls on Base L2, followed by autonomous HTTP 402 USDC micropayment verification.",
  parameters: [
    {
      name: "url",
      description: "The public HTTP or HTTPS URL to scrape and convert to Markdown",
      required: true,
      schema: { type: "string" }
    },
    {
      name: "receipt",
      description: "Optional on-chain USDC payment transaction hash on Base L2 (Chain ID: 8453)",
      required: false,
      schema: { type: "string" }
    }
  ],
  validate: async (_runtime: any, message: any) => {
    const text = message?.content?.text || "";
    const directUrl = message?.content?.url;
    return Boolean(directUrl || text.match(/https?:\/\/[^\s]+/));
  },
  handler: async (runtime: any, message: any, state?: any, options?: Record<string, any>, callback?: any) => {
    // 1. Structured parameter extraction with fallbacks (planner options.parameters -> options -> message.content)
    const params = options?.parameters || (typeof options === "object" && options !== null ? options : {});
    const targetUrl: string | undefined =
      params.url ||
      options?.url ||
      message?.content?.url ||
      (message?.content?.text ? message.content.text.match(/https?:\/\/[^\s"'`<>]+/)?.[0] : undefined);

    if (!targetUrl) {
      const errResp = {
        success: false,
        error: "Missing URL",
        text: "Please provide a valid URL to scrape."
      };
      if (callback) await callback(errResp);
      return errResp;
    }

    // 2. Receipt extraction from planner params, options, message content, state, or runtime settings
    let receipt: string | undefined =
      params.receipt ||
      params.txHash ||
      options?.receipt ||
      options?.txHash ||
      message?.content?.receipt ||
      message?.content?.txHash ||
      state?.receipt ||
      state?.txHash ||
      (runtime?.getSetting ? runtime.getSetting("X402_PAYMENT_RECEIPT") : undefined);

    const workerUrl = (params.workerUrl || options?.workerUrl || runtime?.getSetting?.("X402_WORKER_URL") || DEFAULT_WORKER_URL).replace(/\/$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "elizaos-plugin-x402-scraper/1.4.4"
    };

    if (receipt) {
      headers["X-Payment-Receipt"] = receipt;
    }

    try {
      // 3. First execution / probe (consumes free grace tier if available)
      const res = await fetch(`${workerUrl}/v1/scrape`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: targetUrl })
      });

      // Successful scrape response
      if (res.ok) {
        const data = (await res.json()) as any;
        const result = {
          success: true,
          url: targetUrl,
          title: data.title || "Untitled Page",
          markdown: data.markdown || "",
          tokensEstimated: data.tokens_estimated || 0,
          paid: Boolean(receipt)
        };

        if (callback) {
          await callback({
            text: `# ${result.title}\n\n${result.markdown}`,
            content: result,
            action: "X402_SCRAPE"
          });
        }
        return result;
      }

      // 4. HTTP 402 Payment Required handling
      if (res.status === 402) {
        const paymentReqHeader = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
        let paymentRequirements: any = null;

        if (paymentReqHeader) {
          try {
            const raw = typeof atob === "function" ? atob(paymentReqHeader) : Buffer.from(paymentReqHeader, "base64").toString("utf-8");
            paymentRequirements = JSON.parse(raw);
          } catch {
            // ignore base64 decode failure
          }
        }

        if (!paymentRequirements) {
          try {
            paymentRequirements = await res.json();
          } catch {
            paymentRequirements = {};
          }
        }

        const accepts = paymentRequirements?.accepts?.[0];
        const amountUnits = accepts?.amount || "5000";
        const recipient = accepts?.payTo || DEFAULT_TREASURY;
        const assetContract = accepts?.asset || USDC_BASE_CONTRACT;

        // Autonomous Payment Attempt: Check for runtime wallet provider or service
        const walletProvider =
          options?.walletProvider ||
          (runtime?.getService ? runtime.getService("wallet") : null) ||
          (runtime?.getProvider ? runtime.getProvider("wallet") : null);

        // Rail A: EIP-712 TransferWithAuthorization
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

            const signature = await walletProvider.signTypedData({
              domain: {
                name: "USD Coin",
                version: "2",
                chainId: 8453,
                verifyingContract: assetContract
              },
              types: {
                TransferWithAuthorization: [
                  { name: "from", type: "address" },
                  { name: "to", type: "address" },
                  { name: "value", type: "uint256" },
                  { name: "validAfter", type: "uint256" },
                  { name: "validBefore", type: "uint256" },
                  { name: "nonce", type: "bytes32" }
                ]
              },
              primaryType: "TransferWithAuthorization",
              message: {
                from: fromAddress,
                to: recipient,
                value: BigInt(amountUnits),
                validAfter: BigInt(now - 60),
                validBefore: BigInt(now + 3600),
                nonce
              }
            });

            const paymentPayload = {
              x402Version: 2,
              scheme: "exact",
              network: "eip155:8453",
              accepted: accepts,
              payload: {
                signature,
                authorization: {
                  from: fromAddress,
                  to: recipient,
                  value: amountUnits,
                  validAfter: (now - 60).toString(),
                  validBefore: (now + 3600).toString(),
                  nonce
                }
              }
            };

            const b64 = typeof btoa === "function" ? btoa(JSON.stringify(paymentPayload)) : Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
            const retryRes = await fetch(`${workerUrl}/v1/scrape`, {
              method: "POST",
              headers: {
                ...headers,
                "PAYMENT-SIGNATURE": b64
              },
              body: JSON.stringify({ url: targetUrl })
            });

            if (retryRes.ok) {
              const paidData = (await retryRes.json()) as any;
              const paidResult = {
                success: true,
                url: targetUrl,
                title: paidData.title || "Untitled Page",
                markdown: paidData.markdown || "",
                tokensEstimated: paidData.tokens_estimated || 0,
                paid: true,
                paymentScheme: "eip712"
              };
              if (callback) {
                await callback({
                  text: `# ${paidResult.title}\n\n${paidResult.markdown}`,
                  content: paidResult,
                  action: "X402_SCRAPE"
                });
              }
              return paidResult;
            }
          } catch {
            // Fall through to Rail B or structured 402 invoice
          }
        }

        // Rail B: Direct ERC-20 transfer fallback
        if (walletProvider && typeof walletProvider.sendTransaction === "function") {
          try {
            const hexAmount = BigInt(amountUnits).toString(16).padStart(64, "0");
            const cleanRecipient = recipient.toLowerCase().replace(/^0x/, "").padStart(64, "0");
            const transferData = `0xa9059cbb${cleanRecipient}${hexAmount}`;

            const txHash = await walletProvider.sendTransaction({
              to: assetContract,
              data: transferData
            });

            const retryReceiptRes = await fetch(`${workerUrl}/v1/scrape`, {
              method: "POST",
              headers: {
                ...headers,
                "X-Payment-Receipt": txHash
              },
              body: JSON.stringify({ url: targetUrl })
            });

            if (retryReceiptRes.ok) {
              const paidData = (await retryReceiptRes.json()) as any;
              const paidResult = {
                success: true,
                url: targetUrl,
                title: paidData.title || "Untitled Page",
                markdown: paidData.markdown || "",
                tokensEstimated: paidData.tokens_estimated || 0,
                paid: true,
                txHash
              };
              if (callback) {
                await callback({
                  text: `# ${paidResult.title}\n\n${paidResult.markdown}`,
                  content: paidResult,
                  action: "X402_SCRAPE"
                });
              }
              return paidResult;
            }
          } catch {
            // Fall through to structured 402 return
          }
        }

        // Structured 402 response when automated settlement is not configured
        const paymentInvoice = {
          success: false,
          status: 402,
          error: "HTTP 402 Payment Required",
          protocol: "x402",
          network: "base",
          chainId: 8453,
          asset: "USDC",
          contractAddress: assetContract,
          amountUnits,
          amountUSDC: "0.005",
          recipient,
          message: "Free trial calls exhausted. Provide an on-chain Base USDC transaction hash in options.receipt or connect an EVM wallet provider.",
          instructions: `Send 0.005 USDC on Base L2 to ${recipient} and resubmit with receipt: "<tx_hash>".`
        };

        if (callback) {
          await callback({
            text: `HTTP 402 Payment Required: Free trial exhausted. Please pay 0.005 USDC on Base to ${recipient} or provide an on-chain receipt hash.`,
            content: paymentInvoice,
            action: "X402_SCRAPE"
          });
        }
        return paymentInvoice;
      }

      // Non-402 HTTP errors
      const errText = await res.text();
      const errorResult = {
        success: false,
        status: res.status,
        error: `HTTP Error ${res.status}`,
        details: errText
      };

      if (callback) {
        await callback({
          text: `Failed to scrape ${targetUrl} (Status ${res.status}): ${errText}`,
          content: errorResult,
          action: "X402_SCRAPE"
        });
      }
      return errorResult;
    } catch (networkErr: any) {
      const netError = {
        success: false,
        error: networkErr.message || "Network request failed"
      };

      if (callback) {
        await callback({
          text: `Error executing x402 scrape: ${networkErr.message}`,
          content: netError,
          action: "X402_SCRAPE"
        });
      }
      return netError;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Can you scrape https://news.ycombinator.com and extract the markdown?" }
      },
      {
        user: "{{agentName}}",
        content: { text: "Scraping Hacker News via x402 engine on Base L2...", action: "X402_SCRAPE" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Scrape https://docs.base.org/using-base with payment receipt 0x9f1a2b3c4d5e6f...",
          url: "https://docs.base.org/using-base",
          receipt: "0x9f1a2b3c4d5e6f"
        }
      },
      {
        user: "{{agentName}}",
        content: { text: "Verified payment receipt. Extracted clean documentation markdown.", action: "X402_SCRAPE" }
      }
    ]
  ]
};

export const x402Plugin: Plugin = {
  name: "x402-scraper",
  description: "Autonomous HTTP 402 Web Scraper and Markdown Extraction Plugin on Base L2",
  actions: [x402ScraperAction],
  evaluators: [],
  providers: []
};

export default x402Plugin;
