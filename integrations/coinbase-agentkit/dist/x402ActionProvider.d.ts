import { z } from "zod";
export interface Network {
    protocolFamily: string;
    networkId?: string;
    chainId?: string | number;
}
export interface WalletProvider {
    getAddress?: () => Promise<string>;
    sendTransaction?: (tx: {
        to: string;
        data?: string;
        value?: bigint | string;
    }) => Promise<string>;
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
/**
 * Autonomous HTTP 402 Web Scraper & Intelligence Action Provider for Coinbase AgentKit.
 * Enables AI agents to scrape, digest, search, audit, and extract Twitter intelligence on Base L2.
 */
export declare class X402ScraperActionProvider {
    readonly name = "x402_scraper";
    readonly actionProviders: any[];
    readonly workerUrl: string;
    readonly treasuryAddress: string;
    constructor(config?: X402ScraperConfig);
    /**
     * Verifies if the network is supported (Base Mainnet / EVM)
     */
    supportsNetwork(network: Network): boolean;
    /**
     * Executes HTTP request with dual-rail autonomous x402 payment handling (EIP-712 signature or direct receipt)
     */
    private executeWithPayment;
    /**
     * Returns all 6 AgentKit actions bound to the current wallet provider
     */
    getActions(walletProvider?: WalletProvider): Action[];
}
