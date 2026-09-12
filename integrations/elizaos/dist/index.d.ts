export interface Action {
    name: string;
    similes: string[];
    description: string;
    validate: (runtime: any, message: any) => Promise<boolean>;
    handler: (runtime: any, message: any, state?: any, options?: any, callback?: any) => Promise<boolean>;
    examples: any[][];
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
