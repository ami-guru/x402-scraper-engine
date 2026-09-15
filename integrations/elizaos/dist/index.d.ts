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
    type?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
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
    handler: (runtime: any, message: any, state?: any, options?: Record<string, any>, callback?: (response: any) => Promise<any> | any) => Promise<any>;
    examples: ActionExample[][];
}
export interface Plugin {
    name: string;
    description: string;
    actions: Action[];
    evaluators: any[];
    providers: any[];
}
export declare const x402ScraperAction: Action;
export declare const x402Plugin: Plugin;
export default x402Plugin;
