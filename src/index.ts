import { Env, ScrapeRequest, SearchRequest, TwitterSearchRequest, TwitterProfileRequest, ScrapeResponse, TwitterSearchResponse, TwitterProfileResponse } from './types';
import { validateUrl, scrapeToMarkdown, searchAndScrapeToMarkdown } from './scraper';
import { searchTwitter, getTwitterProfile } from './twitter';
import { verifyBasePayment, checkAndRecordReplay } from './verifier';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment-Receipt, X-Payment-Version, X-Payment-Network',
  'Access-Control-Expose-Headers': 'X-Payment-Version, X-Payment-Network, X-Payment-Chain-Id, X-Payment-Asset, X-Payment-Asset-Address, X-Payment-Amount, X-Payment-To, X-Payment-Window'
};

function jsonResponse(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

function getOpenApiSpec(origin: string, env: Env) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'x402 Scraper Engine API',
      description: 'Web3 HTTP 402 Micropayment Web Scraper & Markdown Conversion Service for Autonomous AI Agents on Base L2.',
      version: '1.0.0',
      contact: {
        name: 'ASOT Marketing and Investment',
        url: 'https://getguruautomations.com',
        email: 'ops@getguruautomations.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: origin,
        description: 'Cloudflare Edge Production Server'
      }
    ],
    paths: {
      '/v1/scrape': {
        post: {
          summary: 'Scrape URL and convert to clean Markdown',
          description: 'Fetches the target URL, strips JavaScript/CSS/SVG/base64 bloat, converts to token-efficient Markdown, and verifies on-chain microtransaction payment (0.002 USDC on Base).',
          operationId: 'cleanWebScrape',
          parameters: [
            {
              name: 'X-Payment-Receipt',
              in: 'header',
              required: false,
              description: 'Base L2 Transaction hash proving 0.002 USDC transfer to treasury.',
              schema: { type: 'string', example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      format: 'uri',
                      description: 'The target webpage URL to scrape.',
                      example: 'https://news.ycombinator.com'
                    }
                  },
                  required: ['url']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful scrape and markdown extraction',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      url: { type: 'string', example: 'https://news.ycombinator.com' },
                      title: { type: 'string', example: 'Hacker News' },
                      markdown: { type: 'string', example: '# Hacker News\n\n- [Story 1](https://...)' },
                      tokens_estimated: { type: 'integer', example: 240 },
                      payment: {
                        type: 'object',
                        properties: {
                          tx_hash: { type: 'string' },
                          network: { type: 'string', example: 'base' },
                          amount: { type: 'string', example: '0.002' },
                          asset: { type: 'string', example: 'USDC' },
                          settled_at: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '402': {
              description: 'Payment Required - Microtransaction Challenge (0.02 USDC)',
              headers: {
                'X-Payment-Version': { schema: { type: 'string', example: '1' } },
                'X-Payment-Network': { schema: { type: 'string', example: 'base' } },
                'X-Payment-Chain-Id': { schema: { type: 'string', example: '8453' } },
                'X-Payment-Asset': { schema: { type: 'string', example: 'USDC' } },
                'X-Payment-Asset-Address': { schema: { type: 'string', example: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' } },
                'X-Payment-Amount': { schema: { type: 'string', example: '0.02' } },
                'X-Payment-To': { schema: { type: 'string', example: env.TREASURY_WALLET_ADDRESS } },
                'X-Payment-Window': { schema: { type: 'string', example: '900' } }
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string', example: 'Payment Required' },
                      message: { type: 'string' },
                      payment: {
                        type: 'object',
                        properties: {
                          version: { type: 'integer', example: 1 },
                          network: { type: 'string', example: 'base' },
                          chainId: { type: 'integer', example: 8453 },
                          asset: { type: 'string', example: 'USDC' },
                          contractAddress: { type: 'string', example: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
                          amount: { type: 'string', example: '0.02' },
                          recipient: { type: 'string', example: env.TREASURY_WALLET_ADDRESS },
                          windowSeconds: { type: 'integer', example: 900 }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Bad Request, SSRF violation, or Replay detected'
            }
          }
        }
      },
      '/v1/search': {
        post: {
          summary: 'Deep Search and Multi-Source Markdown Scrape (0.05 USDC)',
          description: 'Executes web search across multiple sources, scrapes and extracts clean Markdown summaries from top results on Base L2 microtransaction.',
          operationId: 'cleanWebSearch',
          parameters: [
            {
              name: 'X-Payment-Receipt',
              in: 'header',
              required: false,
              description: 'Base L2 Transaction hash proving 0.05 USDC transfer to treasury.',
              schema: { type: 'string', example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Search query for deep research.', example: 'latest autonomous agent protocols 2026' },
                    limit: { type: 'integer', description: 'Max number of top results to scrape (default: 3).', example: 3 }
                  },
                  required: ['query']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful deep search and multi-source scrape',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      query: { type: 'string' },
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            url: { type: 'string' },
                            snippet: { type: 'string' },
                            markdownSummary: { type: 'string' }
                          }
                        }
                      },
                      tokens_estimated: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '402': {
              description: 'Payment Required - Search Microtransaction Challenge (0.05 USDC)'
            }
          }
        }
      },
      '/health': {
        get: {
          summary: 'Health and protocol info',
          responses: {
            '200': { description: 'Service operational status' }
          }
        }
      }
    }
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. Health, OpenAPI & Manifest Discovery Routes
    if (request.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/v1/info') {
        return jsonResponse({
          service: 'x402-scraper-engine',
          status: 'operational',
          version: '1.2.0',
          description: 'HTTP 402 Web3 Microtransaction Scraper, Deep Search & Twitter/X Intelligence Engine for AI Agents on Base L2',
          pricing: {
            scrape_usdc: env.PRICE_USDC || '0.02',
            search_usdc: env.SEARCH_PRICE_USDC || '0.05',
            twitter_search_usdc: env.TWITTER_SEARCH_PRICE_USDC || '0.05',
            twitter_profile_usdc: env.TWITTER_PROFILE_PRICE_USDC || '0.03'
          },
          payment: {
            protocol: 'x402',
            network: env.NETWORK || 'base',
            chainId: Number(env.CHAIN_ID || 8453),
            asset: 'USDC',
            contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            recipient: env.TREASURY_WALLET_ADDRESS,
            windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900)
          },
          docs: 'https://github.com/ami-guru/x402-scraper-engine',
          openapi: `${url.origin}/openapi.json`,
          mcp: `${url.origin}/mcp.json`
        });
      }

      if (url.pathname === '/openapi.json') {
        return jsonResponse(getOpenApiSpec(url.origin, env));
      }

      if (url.pathname === '/.well-known/ai-plugin.json') {
        return jsonResponse({
          schema_version: 'v1',
          name_for_human: 'x402 Scraper & Twitter Intelligence',
          name_for_model: 'clean_web_scrape_search_and_twitter',
          description_for_human: 'Pay-per-call web scraper ($0.02), deep web search ($0.05), and Twitter/X sentiment intelligence ($0.05) converting feeds to token-efficient markdown on Base.',
          description_for_model: 'Scrapes web pages ($0.02), searches the web ($0.05), and queries Twitter cashtags/profiles ($0.05). Automatically settles via HTTP 402 on Base.',
          auth: { type: 'none' },
          api: { type: 'openapi', url: `${url.origin}/openapi.json` },
          logo_url: 'https://getguruautomations.com/favicon.ico',
          contact_email: 'ops@getguruautomations.com',
          legal_info_url: 'https://getguruautomations.com/terms'
        });
      }

      if (url.pathname === '/.well-known/x402.json') {
        return jsonResponse({
          x402_version: '1.0',
          network: env.NETWORK || 'base',
          chain_id: Number(env.CHAIN_ID || 8453),
          asset: 'USDC',
          asset_contract: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          recipient: env.TREASURY_WALLET_ADDRESS,
          max_receipt_age_seconds: Number(env.PAYMENT_WINDOW_SECONDS || 900),
          endpoints: [
            {
              path: '/v1/scrape',
              method: 'POST',
              pricing: '0.02 USDC',
              amount_units: '20000'
            },
            {
              path: '/v1/search',
              method: 'POST',
              pricing: '0.05 USDC',
              amount_units: '50000'
            },
            {
              path: '/v1/twitter/search',
              method: 'POST',
              pricing: '0.05 USDC',
              amount_units: '50000'
            },
            {
              path: '/v1/twitter/profile',
              method: 'POST',
              pricing: '0.03 USDC',
              amount_units: '30000'
            }
          ]
        });
      }
    }

    // 3. POST /v1/scrape Route ($0.02 USDC)
    if (request.method === 'POST' && url.pathname === '/v1/scrape') {
      let body: ScrapeRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "url": "https://..." }' }, 400);
      }

      if (!body || !body.url) {
        return jsonResponse({ error: 'Missing required field: "url"' }, 400);
      }

      // Validate URL before requesting payment
      const urlCheck = validateUrl(body.url);
      if (!urlCheck.valid) {
        return jsonResponse({ error: 'Invalid or prohibited target URL', details: urlCheck.error }, 400);
      }

      // Check for payment receipt
      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const paymentConfig = {
        version: '1',
        network: env.NETWORK || 'base',
        chainId: String(env.CHAIN_ID || 8453),
        asset: 'USDC',
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: env.PRICE_USDC || '0.02',
        recipient: env.TREASURY_WALLET_ADDRESS,
        windowSeconds: String(env.PAYMENT_WINDOW_SECONDS || 900)
      };

      const paymentHeaders = {
        'X-Payment-Version': paymentConfig.version,
        'X-Payment-Network': paymentConfig.network,
        'X-Payment-Chain-Id': paymentConfig.chainId,
        'X-Payment-Asset': paymentConfig.asset,
        'X-Payment-Asset-Address': paymentConfig.contractAddress,
        'X-Payment-Amount': paymentConfig.amount,
        'X-Payment-To': paymentConfig.recipient,
        'X-Payment-Window': paymentConfig.windowSeconds
      };

      // If no receipt provided, trigger HTTP 402 Challenge
      if (!txHash) {
        return jsonResponse(
          {
            error: 'Payment Required',
            message: `This endpoint requires an on-chain microtransaction of ${paymentConfig.amount} USDC on Base.`,
            payment: {
              version: Number(paymentConfig.version),
              network: paymentConfig.network,
              chainId: Number(paymentConfig.chainId),
              asset: paymentConfig.asset,
              contractAddress: paymentConfig.contractAddress,
              amount: paymentConfig.amount,
              recipient: paymentConfig.recipient,
              windowSeconds: Number(paymentConfig.windowSeconds),
              instruction: `Transfer ${paymentConfig.amount} USDC to ${paymentConfig.recipient} on Base (Chain ID ${paymentConfig.chainId}), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
            }
          },
          402,
          paymentHeaders
        );
      }

      // Verify on-chain payment (20,000 units = $0.02 USDC)
      const requiredUnits = env.PRICE_USDC_UNITS ? BigInt(env.PRICE_USDC_UNITS) : 20000n;
      const verification = await verifyBasePayment(txHash, env, requiredUnits);
      if (!verification.valid) {
        return jsonResponse(
          {
            error: 'Payment Verification Failed',
            details: verification.error,
            paymentRequirement: paymentConfig
          },
          402,
          paymentHeaders
        );
      }

      // Check Replay Protection in Cloudflare KV
      const replayCheck = await checkAndRecordReplay(txHash, env, {
        targetUrl: body.url,
        action: 'scrape',
        sender: verification.sender,
        amountUnits: verification.amountUnits?.toString(),
        timestamp: verification.timestamp
      });

      if (replayCheck.replayed) {
        return jsonResponse(
          {
            error: 'Replay Detected',
            message: replayCheck.error || 'Transaction has already been redeemed.'
          },
          400
        );
      }

      // Perform Scrape & Markdown Conversion
      try {
        const scrapeResult = await scrapeToMarkdown(body.url);

        const responsePayload: ScrapeResponse = {
          success: true,
          url: body.url,
          title: scrapeResult.title,
          markdown: scrapeResult.markdown,
          tokens_estimated: scrapeResult.tokensEstimated,
          payment: {
            tx_hash: txHash,
            network: paymentConfig.network,
            amount: paymentConfig.amount,
            asset: paymentConfig.asset,
            settled_at: new Date(verification.timestamp! * 1000).toISOString()
          }
        };

        return jsonResponse(responsePayload, 200);
      } catch (scrapeErr: any) {
        return jsonResponse(
          {
            error: 'Scrape Execution Failed',
            message: scrapeErr.message || 'Failed to fetch or parse target URL.'
          },
          502
        );
      }
    }

    // 4. POST /v1/search Route ($0.05 USDC Deep Search & Scrape)
    if (request.method === 'POST' && url.pathname === '/v1/search') {
      let body: SearchRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "query": "..." }' }, 400);
      }

      if (!body || !body.query || !body.query.trim()) {
        return jsonResponse({ error: 'Missing required field: "query"' }, 400);
      }

      // Check for payment receipt
      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const searchPaymentConfig = {
        version: '1',
        network: env.NETWORK || 'base',
        chainId: String(env.CHAIN_ID || 8453),
        asset: 'USDC',
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: env.SEARCH_PRICE_USDC || '0.05',
        recipient: env.TREASURY_WALLET_ADDRESS,
        windowSeconds: String(env.PAYMENT_WINDOW_SECONDS || 900)
      };

      const searchPaymentHeaders = {
        'X-Payment-Version': searchPaymentConfig.version,
        'X-Payment-Network': searchPaymentConfig.network,
        'X-Payment-Chain-Id': searchPaymentConfig.chainId,
        'X-Payment-Asset': searchPaymentConfig.asset,
        'X-Payment-Asset-Address': searchPaymentConfig.contractAddress,
        'X-Payment-Amount': searchPaymentConfig.amount,
        'X-Payment-To': searchPaymentConfig.recipient,
        'X-Payment-Window': searchPaymentConfig.windowSeconds
      };

      // If no receipt provided, trigger HTTP 402 Challenge
      if (!txHash) {
        return jsonResponse(
          {
            error: 'Payment Required',
            message: `This search & scrape endpoint requires an on-chain microtransaction of ${searchPaymentConfig.amount} USDC on Base.`,
            payment: {
              version: Number(searchPaymentConfig.version),
              network: searchPaymentConfig.network,
              chainId: Number(searchPaymentConfig.chainId),
              asset: searchPaymentConfig.asset,
              contractAddress: searchPaymentConfig.contractAddress,
              amount: searchPaymentConfig.amount,
              recipient: searchPaymentConfig.recipient,
              windowSeconds: Number(searchPaymentConfig.windowSeconds),
              instruction: `Transfer ${searchPaymentConfig.amount} USDC to ${searchPaymentConfig.recipient} on Base (Chain ID ${searchPaymentConfig.chainId}), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
            }
          },
          402,
          searchPaymentHeaders
        );
      }

      // Verify on-chain payment (50,000 units = $0.05 USDC)
      const requiredUnits = env.SEARCH_PRICE_UNITS ? BigInt(env.SEARCH_PRICE_UNITS) : 50000n;
      const verification = await verifyBasePayment(txHash, env, requiredUnits);
      if (!verification.valid) {
        return jsonResponse(
          {
            error: 'Payment Verification Failed',
            details: verification.error,
            paymentRequirement: searchPaymentConfig
          },
          402,
          searchPaymentHeaders
        );
      }

      // Check Replay Protection in Cloudflare KV
      const replayCheck = await checkAndRecordReplay(txHash, env, {
        query: body.query,
        action: 'search',
        sender: verification.sender,
        amountUnits: verification.amountUnits?.toString(),
        timestamp: verification.timestamp
      });

      if (replayCheck.replayed) {
        return jsonResponse(
          {
            error: 'Replay Detected',
            message: replayCheck.error || 'Transaction has already been redeemed.'
          },
          400
        );
      }

      // Perform Search & Deep Scrape
      try {
        const searchResult = await searchAndScrapeToMarkdown(body.query, body.limit || 3);

        return jsonResponse(
          {
            success: true,
            query: searchResult.query,
            results: searchResult.results,
            tokens_estimated: searchResult.tokensEstimated,
            payment: {
              tx_hash: txHash,
              network: searchPaymentConfig.network,
              amount: searchPaymentConfig.amount,
              asset: searchPaymentConfig.asset,
              settled_at: new Date(verification.timestamp! * 1000).toISOString()
            }
          },
          200
        );
      } catch (searchErr: any) {
        return jsonResponse(
          {
            error: 'Search Execution Failed',
            message: searchErr.message || 'Failed to execute web search.'
          },
          502
        );
      }
    }

    // 5. POST /v1/twitter/search Route ($0.05 USDC)
    if (request.method === 'POST' && url.pathname === '/v1/twitter/search') {
      let body: TwitterSearchRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "query": "..." }' }, 400);
      }

      if (!body || !body.query || !body.query.trim()) {
        return jsonResponse({ error: 'Missing required field: "query"' }, 400);
      }

      // Check for payment receipt
      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const twitterPaymentConfig = {
        version: '1',
        network: env.NETWORK || 'base',
        chainId: String(env.CHAIN_ID || 8453),
        asset: 'USDC',
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: env.TWITTER_SEARCH_PRICE_USDC || '0.05',
        recipient: env.TREASURY_WALLET_ADDRESS,
        windowSeconds: String(env.PAYMENT_WINDOW_SECONDS || 900)
      };

      const twitterHeaders = {
        'X-Payment-Version': twitterPaymentConfig.version,
        'X-Payment-Network': twitterPaymentConfig.network,
        'X-Payment-Chain-Id': twitterPaymentConfig.chainId,
        'X-Payment-Asset': twitterPaymentConfig.asset,
        'X-Payment-Asset-Address': twitterPaymentConfig.contractAddress,
        'X-Payment-Amount': twitterPaymentConfig.amount,
        'X-Payment-To': twitterPaymentConfig.recipient,
        'X-Payment-Window': twitterPaymentConfig.windowSeconds
      };

      // 402 Challenge if no receipt
      if (!txHash) {
        return jsonResponse(
          {
            error: 'Payment Required',
            message: `This Twitter search endpoint requires an on-chain microtransaction of ${twitterPaymentConfig.amount} USDC on Base.`,
            payment: {
              version: Number(twitterPaymentConfig.version),
              network: twitterPaymentConfig.network,
              chainId: Number(twitterPaymentConfig.chainId),
              asset: twitterPaymentConfig.asset,
              contractAddress: twitterPaymentConfig.contractAddress,
              amount: twitterPaymentConfig.amount,
              recipient: twitterPaymentConfig.recipient,
              windowSeconds: Number(twitterPaymentConfig.windowSeconds),
              instruction: `Transfer ${twitterPaymentConfig.amount} USDC to ${twitterPaymentConfig.recipient} on Base (Chain ID ${twitterPaymentConfig.chainId}), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
            }
          },
          402,
          twitterHeaders
        );
      }

      // Verify on-chain payment (50,000 units = $0.05 USDC)
      const requiredUnits = env.TWITTER_SEARCH_PRICE_UNITS ? BigInt(env.TWITTER_SEARCH_PRICE_UNITS) : 50000n;
      const verification = await verifyBasePayment(txHash, env, requiredUnits);
      if (!verification.valid) {
        return jsonResponse(
          {
            error: 'Payment Verification Failed',
            details: verification.error,
            paymentRequirement: twitterPaymentConfig
          },
          402,
          twitterHeaders
        );
      }

      // Check Replay Protection in Cloudflare KV
      const replayCheck = await checkAndRecordReplay(txHash, env, {
        query: body.query,
        action: 'twitter_search',
        sender: verification.sender,
        amountUnits: verification.amountUnits?.toString(),
        timestamp: verification.timestamp
      });

      if (replayCheck.replayed) {
        return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
      }

      // Execute Twitter Search
      try {
        const twitterResult = await searchTwitter(body.query, body.limit || 5);
        const responsePayload: TwitterSearchResponse = {
          success: true,
          query: twitterResult.query,
          tweets: twitterResult.tweets,
          markdown: twitterResult.markdown,
          tokens_estimated: twitterResult.tokensEstimated,
          payment: {
            tx_hash: txHash,
            network: twitterPaymentConfig.network,
            amount: twitterPaymentConfig.amount,
            asset: twitterPaymentConfig.asset,
            settled_at: new Date(verification.timestamp! * 1000).toISOString()
          }
        };

        return jsonResponse(responsePayload, 200);
      } catch (twitterErr: any) {
        return jsonResponse({ error: 'Twitter Search Failed', message: twitterErr.message }, 502);
      }
    }

    // 6. POST /v1/twitter/profile Route ($0.03 USDC)
    if (request.method === 'POST' && url.pathname === '/v1/twitter/profile') {
      let body: TwitterProfileRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "username": "..." }' }, 400);
      }

      if (!body || !body.username || !body.username.trim()) {
        return jsonResponse({ error: 'Missing required field: "username"' }, 400);
      }

      // Check for payment receipt
      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const profilePaymentConfig = {
        version: '1',
        network: env.NETWORK || 'base',
        chainId: String(env.CHAIN_ID || 8453),
        asset: 'USDC',
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: env.TWITTER_PROFILE_PRICE_USDC || '0.03',
        recipient: env.TREASURY_WALLET_ADDRESS,
        windowSeconds: String(env.PAYMENT_WINDOW_SECONDS || 900)
      };

      const profileHeaders = {
        'X-Payment-Version': profilePaymentConfig.version,
        'X-Payment-Network': profilePaymentConfig.network,
        'X-Payment-Chain-Id': profilePaymentConfig.chainId,
        'X-Payment-Asset': profilePaymentConfig.asset,
        'X-Payment-Asset-Address': profilePaymentConfig.contractAddress,
        'X-Payment-Amount': profilePaymentConfig.amount,
        'X-Payment-To': profilePaymentConfig.recipient,
        'X-Payment-Window': profilePaymentConfig.windowSeconds
      };

      // 402 Challenge if no receipt
      if (!txHash) {
        return jsonResponse(
          {
            error: 'Payment Required',
            message: `This Twitter profile endpoint requires an on-chain microtransaction of ${profilePaymentConfig.amount} USDC on Base.`,
            payment: {
              version: Number(profilePaymentConfig.version),
              network: profilePaymentConfig.network,
              chainId: Number(profilePaymentConfig.chainId),
              asset: profilePaymentConfig.asset,
              contractAddress: profilePaymentConfig.contractAddress,
              amount: profilePaymentConfig.amount,
              recipient: profilePaymentConfig.recipient,
              windowSeconds: Number(profilePaymentConfig.windowSeconds),
              instruction: `Transfer ${profilePaymentConfig.amount} USDC to ${profilePaymentConfig.recipient} on Base (Chain ID ${profilePaymentConfig.chainId}), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
            }
          },
          402,
          profileHeaders
        );
      }

      // Verify on-chain payment (30,000 units = $0.03 USDC)
      const requiredUnits = env.TWITTER_PROFILE_PRICE_UNITS ? BigInt(env.TWITTER_PROFILE_PRICE_UNITS) : 30000n;
      const verification = await verifyBasePayment(txHash, env, requiredUnits);
      if (!verification.valid) {
        return jsonResponse(
          {
            error: 'Payment Verification Failed',
            details: verification.error,
            paymentRequirement: profilePaymentConfig
          },
          402,
          profileHeaders
        );
      }

      // Check Replay Protection in Cloudflare KV
      const replayCheck = await checkAndRecordReplay(txHash, env, {
        username: body.username,
        action: 'twitter_profile',
        sender: verification.sender,
        amountUnits: verification.amountUnits?.toString(),
        timestamp: verification.timestamp
      });

      if (replayCheck.replayed) {
        return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
      }

      // Execute Twitter Profile Scrape
      try {
        const profileResult = await getTwitterProfile(body.username);
        const responsePayload: TwitterProfileResponse = {
          success: true,
          username: profileResult.username,
          bio: profileResult.bio,
          tweets: profileResult.tweets,
          markdown: profileResult.markdown,
          tokens_estimated: profileResult.tokensEstimated,
          payment: {
            tx_hash: txHash,
            network: profilePaymentConfig.network,
            amount: profilePaymentConfig.amount,
            asset: profilePaymentConfig.asset,
            settled_at: new Date(verification.timestamp! * 1000).toISOString()
          }
        };

        return jsonResponse(responsePayload, 200);
      } catch (profileErr: any) {
        return jsonResponse({ error: 'Twitter Profile Lookup Failed', message: profileErr.message }, 502);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};
