import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { z } from "zod";

const ScrapeSchema = z.object({
  url: z.string().url().describe("The target webpage URL to scrape and convert to clean Markdown.")
});

/**
 * Action Provider for autonomous HTTP 402 web scraping and intelligence on Base L2.
 * Directly integrates with Coinbase AgentKit wallets for seamless micro-settlement.
 */
export class X402ScraperActionProvider extends ActionProvider<EvmWalletProvider> {
  private workerUrl: string;

  constructor(workerUrl: string = "https://x402-scraper-engine.gejoe-tt.workers.dev") {
    super("x402-scraper", []);
    this.workerUrl = workerUrl;
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm" && network.networkId === "base-mainnet";

  @CreateAction({
    name: "clean_web_scrape",
    description: "Scrapes any public webpage and returns clean Markdown. First 2 calls free, then auto-settles 0.005 USDC on Base.",
    schema: ScrapeSchema
  })
  async cleanWebScrape(walletProvider: EvmWalletProvider, args: z.infer<typeof ScrapeSchema>): Promise<string> {
    // 1. Initial attempt (consumes free grace tier if available)
    const initialResp = await fetch(`${this.workerUrl}/v1/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: args.url })
    });

    if (initialResp.ok) {
      const data = await initialResp.json();
      return JSON.stringify(data);
    }

    // 2. If 402 Payment Required, sign on-chain USDC transfer
    if (initialResp.status === 402) {
      const challenge = await initialResp.json() as any;
      const recipient = challenge.payment?.recipient || "0x4107f297256E00F32873f45F50A35a902c1c2034";
      const usdcContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      
      // Transfer 0.005 USDC (5,000 atomic units)
      const txHash = await walletProvider.sendTransaction({
        to: usdcContract,
        data: `0xa9059cbb000000000000000000000000${recipient.substring(2)}0000000000000000000000000000000000000000000000000000000000001388` as `0x${string}`
      });

      // 3. Resubmit with payment receipt
      const paidResp = await fetch(`${this.workerUrl}/v1/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Receipt": txHash
        },
        body: JSON.stringify({ url: args.url })
      });

      return JSON.stringify(await paidResp.json());
    }

    throw new Error(`Scrape failed with status ${initialResp.status}: ${await initialResp.text()}`);
  }
}
