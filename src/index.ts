import { Env, ScrapeRequest, ScrapeResponse } from './types';
import { validateUrl, scrapeToMarkdown } from './scraper';
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
              description: 'Payment Required - Microtransaction Challenge',
              headers: {
                'X-Payment-Version': { schema: { type: 'string', example: '1' } },
                'X-Payment-Network': { schema: { type: 'string', example: 'base' } },
                'X-Payment-Chain-Id': { schema: { type: 'string', example: '8453' } },
                'X-Payment-Asset': { schema: { type: 'string', example: 'USDC' } },
                'X-Payment-Asset-Address': { schema: { type: 'string', example: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' } },
                'X-Payment-Amount': { schema: { type: 'string', example: '0.002' } },
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
                          amount: { type: 'string', example: '0.002' },
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
          version: '1.0.0',
          description: 'HTTP 402 Web3 Microtransaction Scraper & Markdown Optimizer for AI Agents on Base L2',
          payment: {
            protocol: 'x402',
            network: env.NETWORK || 'base',
            chainId: Number(env.CHAIN_ID || 8453),
            asset: 'USDC',
            contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            priceUsdc: env.PRICE_USDC || '0.002',
            recipient: env.TREASURY_WALLET_ADDRESS,
            windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900)
          },
          docs: 'https://github.com/asot-investment/x402-scraper-engine',
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
          name_for_human: 'x402 Markdown Web Scraper',
          name_for_model: 'clean_web_scrape',
          description_for_human: 'Pay-per-call web scraper converting pages to token-efficient markdown via 0.002 USDC on Base.',
          description_for_model: 'Scrapes web pages, strips scripts/styles/SVGs/base64, converts to token-efficient markdown. Automatically settles via HTTP 402 with 0.002 USDC on Base.',
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
          amount: env.PRICE_USDC || '0.002',
          recipient: env.TREASURY_WALLET_ADDRESS,
          max_receipt_age_seconds: Number(env.PAYMENT_WINDOW_SECONDS || 900),
          endpoints: [
            {
              path: '/v1/scrape',
              method: 'POST',
              pricing: '0.002 USDC'
            }
          ]
        });
      }
    }

    // 3. POST /v1/scrape Route
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

      // Payment Details
      const paymentConfig = {
        version: '1',
        network: env.NETWORK || 'base',
        chainId: String(env.CHAIN_ID || 8453),
        asset: 'USDC',
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amount: env.PRICE_USDC || '0.002',
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

      // Verify on-chain payment
      const verification = await verifyBasePayment(txHash, env);
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

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};
