/**
 * agentkit-plugin-x402-scraper
 * Autonomous HTTP 402 Web Scraper, Edge Llama-3 Digest, Security Audit & Twitter Intelligence Action Provider for Coinbase AgentKit on Base L2.
 *
 * @author ASOT Marketing and Investment <ops@getguruautomations.com>
 * @license MIT
 */
export * from "./schemas.js";
export { X402ScraperActionProvider, X402ScraperConfig, WalletProvider, Action, Network } from "./x402ActionProvider.js";
import { X402ScraperActionProvider, X402ScraperConfig } from "./x402ActionProvider.js";
/**
 * Factory function to instantiate an X402ScraperActionProvider for Coinbase AgentKit.
 *
 * @example
 * ```typescript
 * import { AgentKit } from "@coinbase/agentkit";
 * import { x402ScraperActionProvider } from "agentkit-plugin-x402-scraper";
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [x402ScraperActionProvider()]
 * });
 * ```
 */
export declare function x402ScraperActionProvider(config?: X402ScraperConfig): X402ScraperActionProvider;
export default x402ScraperActionProvider;
