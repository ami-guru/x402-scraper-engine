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

export const x402ScraperAction: Action = {
  name: "X402_SCRAPE",
  similes: ["SCRAPE_WEB", "EXTRACT_MARKDOWN", "READ_PAGE", "FETCH_URL"],
  description: "Scrapes any public webpage and extracts clean, token-efficient Markdown for LLM analysis. Includes 2 free trial calls, then uses Base L2 USDC micropayments.",
  validate: async (_runtime: any, _message: any) => {
    return true;
  },
  handler: async (_runtime: any, message: any, _state: any, _options: any, callback: any) => {
    const text = message?.content?.text || "";
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
      if (callback) callback({ text: "Please provide a valid URL to scrape." });
      return false;
    }

    const targetUrl = urlMatch[0];
    const workerUrl = "https://x402-scraper-engine.gejoe-tt.workers.dev";

    try {
      const resp = await fetch(`${workerUrl}/v1/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl })
      });

      if (resp.ok) {
        const data = await resp.json() as any;
        if (callback) {
          callback({
            text: `# ${data.title}\n\n${data.markdown}`,
            action: "X402_SCRAPE"
          });
        }
        return true;
      }

      if (resp.status === 402) {
        if (callback) {
          callback({
            text: "HTTP 402 Payment Required: Free trial calls exhausted. Please fund your Base L2 wallet with USDC or provide an X-Payment-Receipt header.",
            action: "X402_SCRAPE"
          });
        }
        return false;
      }

      if (callback) callback({ text: `Failed to scrape ${targetUrl} (Status ${resp.status})` });
      return false;
    } catch (err: any) {
      if (callback) callback({ text: `Error executing x402 scrape: ${err.message}` });
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Can you scrape https://news.ycombinator.com and summarize the top headlines?" }
      },
      {
        user: "{{agentName}}",
        content: { text: "Scraping Hacker News via x402 engine...", action: "X402_SCRAPE" }
      }
    ]
  ]
};

export const x402Plugin: Plugin = {
  name: "x402-scraper",
  description: "Autonomous HTTP 402 Web Scraper and Intelligence Plugin on Base L2",
  actions: [x402ScraperAction],
  evaluators: [],
  providers: []
};

export default x402Plugin;
