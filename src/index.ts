import {
  Env,
  ScrapeRequest,
  DigestRequest,
  AuditRequest,
  SearchRequest,
  TwitterSearchRequest,
  TwitterProfileRequest,
  ScrapeResponse,
  DigestResponse,
  AuditResponse,
  TwitterSearchResponse,
  TwitterProfileResponse
} from './types';
import { validateUrl, scrapeToMarkdown, searchAndScrapeToMarkdown } from './scraper';
import { synthesizeDigest, auditSecuritySignal } from './digest';
import { searchTwitter, getTwitterProfile } from './twitter';
import { verifyBasePayment, checkAndRecordReplay, createPaymentChallengeHeaders } from './verifier';
import { pingPublicIndexers } from './discovery';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment-Receipt, X-Payment-Version, X-Payment-Network, PAYMENT-REQUIRED',
  'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, X-Payment-Version, X-Payment-Network, X-Payment-Chain-Id, X-Payment-Asset, X-Payment-Asset-Address, X-Payment-Amount, X-Payment-To, X-Payment-Window, X-Grace-Calls-Remaining'
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

interface GraceResult {
  isGrace: boolean;
  remaining: number;
}

async function checkAndConsumeGraceTier(request: Request, env: Env): Promise<GraceResult> {
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (!clientIp || clientIp === 'unknown' || !env.PROCESSED_TXS) {
    return { isGrace: false, remaining: 0 };
  }
  const key = `grace:${clientIp}`;
  try {
    const raw = await env.PROCESSED_TXS.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count < 2) {
      const newCount = count + 1;
      await env.PROCESSED_TXS.put(key, String(newCount), { expirationTtl: 86400 * 7 });
      return { isGrace: true, remaining: 2 - newCount };
    }
    return { isGrace: false, remaining: 0 };
  } catch (err) {
    return { isGrace: false, remaining: 0 };
  }
}

function getOpenApiSpec(origin: string, env: Env) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'x402 Scraper Engine API',
      description: 'Web3 HTTP 402 Micropayment Web Scraper & Agent Intelligence Suite for Autonomous AI Agents on Base L2. Includes 2-call free grace tier.',
      version: '1.4.0',
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
          summary: 'Scrape URL and convert to clean Markdown (0.005 USDC / 2-call grace tier)',
          description: 'Fetches target URL, strips bloat, converts to Markdown. Settle via 2-call free grace tier or on-chain Base USDC microtransaction.',
          operationId: 'cleanWebScrape',
          parameters: [
            {
              name: 'X-Payment-Receipt',
              in: 'header',
              required: false,
              description: 'Base L2 Transaction hash proving 0.005 USDC transfer to treasury (omitted during 2-call grace tier).',
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
                    url: { type: 'string', format: 'uri', description: 'Webpage URL to scrape.', example: 'https://news.ycombinator.com' }
                  },
                  required: ['url']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful scrape' },
            '402': { description: 'Payment Required (Base L2 USDC microtransaction challenge)' }
          }
        }
      },
      '/v1/digest': {
        post: {
          summary: 'Edge LLM Context Synthesis (0.025 USDC)',
          description: 'Scrapes webpage and executes Llama-3-8B context synthesis extracting executive summary & entities.',
          operationId: 'synthesizeWebDigest',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    focus: { type: 'string', description: 'Optional focus topic' }
                  },
                  required: ['url']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful digest extraction' },
            '402': { description: 'Payment Required' }
          }
        }
      },
      '/v1/audit': {
        post: {
          summary: 'Domain & Smart Contract Security Audit (0.080 USDC)',
          description: 'Analyzes website credibility, phishing flags, and smart contract signals.',
          operationId: 'auditWebSignal',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    contract_address: { type: 'string' }
                  },
                  required: ['url']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful security audit' },
            '402': { description: 'Payment Required' }
          }
        }
      },
      '/v1/search': {
        post: {
          summary: 'Deep Search and Multi-Source Scrape (0.050 USDC)',
          description: 'Executes web search across multiple sources and extracts clean Markdown.',
          operationId: 'cleanWebSearch',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', example: 'autonomous AI agent protocols 2026' },
                    limit: { type: 'integer', example: 3 }
                  },
                  required: ['query']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful search' },
            '402': { description: 'Payment Required' }
          }
        }
      },
      '/v1/twitter/search': {
        post: {
          summary: 'Twitter/X Search without $100/mo API fee (0.050 USDC)',
          description: 'Searches public tweets, cashtags, and sentiment.',
          operationId: 'twitterSearch',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', example: '$BASE' },
                    limit: { type: 'integer', example: 5 }
                  },
                  required: ['query']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful Twitter search' },
            '402': { description: 'Payment Required' }
          }
        }
      },
      '/v1/twitter/profile': {
        post: {
          summary: 'Twitter/X Profile Lookup (0.030 USDC)',
          description: 'Extracts bio and recent tweets for any Twitter handle.',
          operationId: 'twitterProfileLookup',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'coinbase' }
                  },
                  required: ['username']
                }
              }
            }
          },
          responses: {
            '200': { description: 'Successful Twitter profile lookup' },
            '402': { description: 'Payment Required' }
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

    // 2. Health, OpenAPI, llms.txt & Manifest Discovery Routes
    if (request.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/v1/info') {
        return jsonResponse({
          service: 'x402-scraper-engine',
          status: 'operational',
          version: '1.4.0',
          description: 'HTTP 402 Multi-Tier Agent Intelligence, Edge LLM Digest, Security Audit & Web Scraper for AI Agents on Base L2',
          free_grace_calls: 2,
          pricing: {
            scrape_usdc: env.SCRAPE_PRICE_USDC || env.PRICE_USDC || '0.005',
            digest_usdc: env.DIGEST_PRICE_USDC || '0.025',
            audit_usdc: env.AUDIT_PRICE_USDC || '0.080',
            search_usdc: env.SEARCH_PRICE_USDC || '0.050',
            twitter_search_usdc: env.TWITTER_SEARCH_PRICE_USDC || '0.050',
            twitter_profile_usdc: env.TWITTER_PROFILE_PRICE_USDC || '0.030'
          },
          payment: {
            protocol: 'x402',
            spec_version: '2.0',
            network: env.NETWORK || 'base',
            chainId: Number(env.CHAIN_ID || 8453),
            asset: 'USDC',
            contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            recipient: env.TREASURY_WALLET_ADDRESS,
            windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900)
          },
          llms_txt: `${url.origin}/llms.txt`,
          bazaar_discovery: `${url.origin}/.well-known/x402.json`,
          docs: 'https://github.com/ami-guru/x402-scraper-engine',
          openapi: `${url.origin}/openapi.json`,
          mcp: `${url.origin}/mcp.json`
        });
      }

      if (url.pathname === '/llms.txt') {
        const llmsContent = `# x402 Scraper Engine

> Production HTTP 402 Web3 Microtransaction Scraper & AI Agent Intelligence Suite on Base L2.

The x402 Scraper Engine enables autonomous AI agents to scrape webpages, synthesize context with Llama-3, search the web, audit domain credibility, and extract Twitter intelligence without credit cards or monthly API subscriptions. Settlement is performed natively in USDC on Base (Chain ID 8453).

## Free Trial Grace Tier
Every new client agent receives 2 free trial calls across any endpoint before requiring on-chain micro-settlement. Simply call any POST endpoint without an X-Payment-Receipt header to test.

## Tools & Endpoints
- POST /v1/scrape: Clean, token-efficient HTML-to-Markdown extraction (0.005 USDC).
- POST /v1/digest: Llama-3 Edge LLM context extraction & entity summary (0.025 USDC).
- POST /v1/audit: Security, phishing, and credibility analysis (0.080 USDC).
- POST /v1/search: Multi-source web search and Markdown scrape (0.050 USDC).
- POST /v1/twitter/search: Cashtag and keyword Twitter search (0.050 USDC).
- POST /v1/twitter/profile: Twitter/X user profile and recent tweets (0.030 USDC).

## Payment Specs
- Network: Base (EVM Chain ID 8453)
- Currency: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Treasury Address: ${env.TREASURY_WALLET_ADDRESS}
- Header: X-Payment-Receipt: <tx_hash>

## MCP Quickstart
Run instantly in Claude Code, Cursor, Windsurf, or Codex CLI:
\`\`\`bash
npx -y x402-scraper-engine
\`\`\`
`;
        return new Response(llmsContent, {
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            ...CORS_HEADERS
          }
        });
      }

      if (url.pathname === '/openapi.json') {
        return jsonResponse(getOpenApiSpec(url.origin, env));
      }

      if (url.pathname === '/e9a7c3b2f1d048e58a7b9c6d3e2f1a0b.txt') {
        return new Response('e9a7c3b2f1d048e58a7b9c6d3e2f1a0b', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      if (url.pathname === '/.well-known/ai-plugin.json') {
        return jsonResponse({
          schema_version: 'v1',
          name_for_human: 'x402 Agent Intelligence Suite',
          name_for_model: 'x402_agent_intelligence',
          description_for_human: 'Autonomous pay-per-call web scraper ($0.005), Edge Llama-3 context digest ($0.025), security audit ($0.080), search ($0.050), and Twitter intelligence ($0.050) on Base. Includes 2 free trial calls.',
          description_for_model: 'Provides high-speed Markdown extraction ($0.005), Edge LLM synthesis ($0.025), security analysis ($0.080), web search ($0.050), and Twitter search ($0.050). Automatically settles via HTTP 402 on Base. Includes 2-call free trial grace tier.',
          auth: { type: 'none' },
          api: { type: 'openapi', url: `${url.origin}/openapi.json` },
          logo_url: 'https://getguruautomations.com/favicon.ico',
          contact_email: 'ops@getguruautomations.com',
          legal_info_url: 'https://getguruautomations.com/terms'
        });
      }

      if (url.pathname === '/.well-known/x402.json') {
        return jsonResponse({
          x402_version: '2.0',
          bazaar_extension_version: '1.0',
          provider: {
            name: 'ASOT Marketing and Investment',
            url: 'https://getguruautomations.com',
            support: 'ops@getguruautomations.com'
          },
          free_grace_calls: 2,
          payment: {
            network: env.NETWORK || 'base',
            chain_id: Number(env.CHAIN_ID || 8453),
            asset: 'USDC',
            asset_contract: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            recipient: env.TREASURY_WALLET_ADDRESS,
            max_receipt_age_seconds: Number(env.PAYMENT_WINDOW_SECONDS || 900)
          },
          endpoints: [
            {
              path: '/v1/scrape',
              method: 'POST',
              name: 'clean_web_scrape',
              pricing: '0.005 USDC',
              amount_units: '5000',
              description: 'Zero-bloat HTML to Markdown extraction for token-efficient LLM context (2-call free grace tier available).',
              tags: ['scraping', 'markdown', 'web']
            },
            {
              path: '/v1/digest',
              method: 'POST',
              name: 'synthesize_web_digest',
              pricing: '0.025 USDC',
              amount_units: '25000',
              description: 'Edge LLM Context Synthesis (Llama-3-8B) extracting executive summary, key takeaways & structured entities.',
              tags: ['ai-synthesis', 'llama3', 'context-compression', 'digest']
            },
            {
              path: '/v1/audit',
              method: 'POST',
              name: 'audit_web_signal',
              pricing: '0.080 USDC',
              amount_units: '80000',
              description: 'Security, credibility, and phishing risk analysis for web domains and smart contracts.',
              tags: ['security', 'audit', 'credibility', 'risk-analysis']
            },
            {
              path: '/v1/search',
              method: 'POST',
              name: 'clean_web_search',
              pricing: '0.050 USDC',
              amount_units: '50000',
              description: 'Multi-source deep web research and synthesized Markdown extraction.',
              tags: ['search', 'deep-research', 'web']
            },
            {
              path: '/v1/twitter/search',
              method: 'POST',
              name: 'twitter_search',
              pricing: '0.050 USDC',
              amount_units: '50000',
              description: 'Searches public tweets, cashtags ($BASE, $ETH), and sentiment across Twitter/X.',
              tags: ['twitter', 'cashtags', 'sentiment', 'social']
            },
            {
              path: '/v1/twitter/profile',
              method: 'POST',
              name: 'twitter_profile_lookup',
              pricing: '0.030 USDC',
              amount_units: '30000',
              description: 'Extracts public Twitter/X profile bio and recent tweets for any handle.',
              tags: ['twitter', 'profile', 'social']
            }
          ]
        });
      }
    }

    // 3. POST /v1/scrape Route (0.005 USDC)
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

      const urlCheck = validateUrl(body.url);
      if (!urlCheck.valid) {
        return jsonResponse({ error: 'Invalid or prohibited target URL', details: urlCheck.error }, 400);
      }

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.SCRAPE_PRICE_USDC || env.PRICE_USDC || '0.005';
      const paymentHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              protocol: 'x402',
              spec_version: '2.0',
              message: `This scrape endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                network: env.NETWORK || 'base',
                chain_id: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                amount_usdc: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            paymentHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.SCRAPE_PRICE_UNITS ? BigInt(env.SCRAPE_PRICE_UNITS) : 5000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          targetUrl: body.url,
          action: 'scrape',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const scrapeResult = await scrapeToMarkdown(body.url);
        const responsePayload: ScrapeResponse = {
          success: true,
          url: body.url,
          title: scrapeResult.title,
          markdown: scrapeResult.markdown,
          tokens_estimated: scrapeResult.tokensEstimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              } as any
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (scrapeErr: any) {
        return jsonResponse({ error: 'Scrape Execution Failed', message: scrapeErr.message }, 502);
      }
    }

    // 4. POST /v1/digest Route (0.025 USDC - Llama 3 Edge Synthesis)
    if (request.method === 'POST' && url.pathname === '/v1/digest') {
      let body: DigestRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "url": "https://..." }' }, 400);
      }

      if (!body || !body.url) {
        return jsonResponse({ error: 'Missing required field: "url"' }, 400);
      }

      const urlCheck = validateUrl(body.url);
      if (!urlCheck.valid) {
        return jsonResponse({ error: 'Invalid or prohibited target URL', details: urlCheck.error }, 400);
      }

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.DIGEST_PRICE_USDC || '0.025';
      const paymentHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              protocol: 'x402',
              spec_version: '2.0',
              message: `This edge LLM digest endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                network: env.NETWORK || 'base',
                chain_id: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                amount_usdc: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            paymentHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.DIGEST_PRICE_UNITS ? BigInt(env.DIGEST_PRICE_UNITS) : 25000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          targetUrl: body.url,
          action: 'digest',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const digestResult = await synthesizeDigest(body.url, env, body.focus);
        const responsePayload: DigestResponse = {
          success: true,
          url: body.url,
          title: digestResult.title,
          executive_summary: digestResult.executive_summary,
          key_takeaways: digestResult.key_takeaways,
          markdown: digestResult.markdown,
          tokens_estimated: digestResult.tokens_estimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              } as any
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (digestErr: any) {
        return jsonResponse({ error: 'Digest Synthesis Failed', message: digestErr.message }, 502);
      }
    }

    // 5. POST /v1/audit Route (0.080 USDC - Security Signal Audit)
    if (request.method === 'POST' && url.pathname === '/v1/audit') {
      let body: AuditRequest;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body. Expected { "url": "https://..." }' }, 400);
      }

      if (!body || !body.url) {
        return jsonResponse({ error: 'Missing required field: "url"' }, 400);
      }

      const urlCheck = validateUrl(body.url);
      if (!urlCheck.valid) {
        return jsonResponse({ error: 'Invalid or prohibited target URL', details: urlCheck.error }, 400);
      }

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.AUDIT_PRICE_USDC || '0.080';
      const paymentHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              protocol: 'x402',
              spec_version: '2.0',
              message: `This security audit endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                network: env.NETWORK || 'base',
                chain_id: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                amount_usdc: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            paymentHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.AUDIT_PRICE_UNITS ? BigInt(env.AUDIT_PRICE_UNITS) : 80000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          targetUrl: body.url,
          action: 'audit',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const auditResult = await auditSecuritySignal(body.url, env, body.contract_address);
        const responsePayload: AuditResponse = {
          success: true,
          url: body.url,
          credibility_score: auditResult.credibility_score,
          risk_level: auditResult.risk_level,
          security_flags: auditResult.security_flags,
          credibility_analysis: auditResult.credibility_analysis,
          technical_signals: auditResult.technical_signals,
          markdown: auditResult.markdown,
          tokens_estimated: auditResult.tokens_estimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              } as any
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (auditErr: any) {
        return jsonResponse({ error: 'Security Audit Failed', message: auditErr.message }, 502);
      }
    }

    // 6. POST /v1/ping-index Route (Autonomous Discovery Broadcast)
    if (request.method === 'POST' && url.pathname === '/v1/ping-index') {
      const pingRes = await pingPublicIndexers(url.origin);
      return jsonResponse(pingRes, 200);
    }

    // 7. POST /v1/search Route ($0.05 USDC Deep Search & Scrape)
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

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.SEARCH_PRICE_USDC || '0.050';
      const searchPaymentHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              message: `This search & scrape endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                version: 1,
                network: env.NETWORK || 'base',
                chainId: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900),
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            searchPaymentHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.SEARCH_PRICE_UNITS ? BigInt(env.SEARCH_PRICE_UNITS) : 50000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, searchPaymentHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          query: body.query,
          action: 'search',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction has already been redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const searchResult = await searchAndScrapeToMarkdown(body.query, body.limit || 3);
        const responsePayload = {
          success: true,
          query: searchResult.query,
          results: searchResult.results,
          tokens_estimated: searchResult.tokensEstimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              }
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (searchErr: any) {
        return jsonResponse({ error: 'Search Execution Failed', message: searchErr.message || 'Failed to execute web search.' }, 502);
      }
    }

    // 8. POST /v1/twitter/search Route ($0.05 USDC)
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

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.TWITTER_SEARCH_PRICE_USDC || '0.050';
      const twitterHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              message: `This Twitter search endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                version: 1,
                network: env.NETWORK || 'base',
                chainId: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900),
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            twitterHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.TWITTER_SEARCH_PRICE_UNITS ? BigInt(env.TWITTER_SEARCH_PRICE_UNITS) : 50000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, twitterHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          query: body.query,
          action: 'twitter_search',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const twitterResult = await searchTwitter(body.query, body.limit || 5);
        const responsePayload: TwitterSearchResponse = {
          success: true,
          query: twitterResult.query,
          tweets: twitterResult.tweets,
          markdown: twitterResult.markdown,
          tokens_estimated: twitterResult.tokensEstimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              } as any
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (twitterErr: any) {
        return jsonResponse({ error: 'Twitter Search Failed', message: twitterErr.message }, 502);
      }
    }

    // 9. POST /v1/twitter/profile Route ($0.03 USDC)
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

      const receiptHeader = request.headers.get('X-Payment-Receipt');
      const authHeader = request.headers.get('Authorization');
      let txHash = receiptHeader?.trim();

      if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
        txHash = authHeader.substring(7).trim();
      }

      const amountUsdc = env.TWITTER_PROFILE_PRICE_USDC || '0.030';
      const profileHeaders = createPaymentChallengeHeaders({
        amountUsdc,
        recipient: env.TREASURY_WALLET_ADDRESS,
        network: env.NETWORK || 'base',
        chainId: env.CHAIN_ID || 8453,
        contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900
      });

      let isGraceCall = false;
      let graceRemaining = 0;

      if (!txHash) {
        const grace = await checkAndConsumeGraceTier(request, env);
        if (grace.isGrace) {
          isGraceCall = true;
          graceRemaining = grace.remaining;
        } else {
          return jsonResponse(
            {
              error: 'Payment Required',
              message: `This Twitter profile endpoint requires an on-chain microtransaction of ${amountUsdc} USDC on Base. Free grace calls exhausted.`,
              payment: {
                version: 1,
                network: env.NETWORK || 'base',
                chainId: Number(env.CHAIN_ID || 8453),
                asset: 'USDC',
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: amountUsdc,
                recipient: env.TREASURY_WALLET_ADDRESS,
                windowSeconds: Number(env.PAYMENT_WINDOW_SECONDS || 900),
                instruction: `Transfer ${amountUsdc} USDC to ${env.TREASURY_WALLET_ADDRESS} on Base (Chain ID 8453), then resubmit with header 'X-Payment-Receipt: <tx_hash>'`
              }
            },
            402,
            profileHeaders
          );
        }
      }

      let settledAt = new Date().toISOString();
      if (!isGraceCall) {
        const requiredUnits = env.TWITTER_PROFILE_PRICE_UNITS ? BigInt(env.TWITTER_PROFILE_PRICE_UNITS) : 30000n;
        const verification = await verifyBasePayment(txHash!, env, requiredUnits);
        if (!verification.valid) {
          return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, profileHeaders);
        }

        const replayCheck = await checkAndRecordReplay(txHash!, env, {
          username: body.username,
          action: 'twitter_profile',
          sender: verification.sender,
          amountUnits: verification.amountUnits?.toString(),
          timestamp: verification.timestamp
        });

        if (replayCheck.replayed) {
          return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
        }
        settledAt = new Date(verification.timestamp! * 1000).toISOString();
      }

      try {
        const profileResult = await getTwitterProfile(body.username);
        const responsePayload: TwitterProfileResponse = {
          success: true,
          username: profileResult.username,
          bio: profileResult.bio,
          tweets: profileResult.tweets,
          markdown: profileResult.markdown,
          tokens_estimated: profileResult.tokensEstimated,
          payment: isGraceCall
            ? {
                mode: 'free_grace_tier',
                calls_remaining: graceRemaining,
                network: env.NETWORK || 'base',
                message: 'Free grace trial active (2 calls per client). Microtransaction required after exhaustion.'
              } as any
            : {
                tx_hash: txHash!,
                network: env.NETWORK || 'base',
                amount: amountUsdc,
                asset: 'USDC',
                settled_at: settledAt
              }
        };

        const extraHeaders: Record<string, string> = isGraceCall
          ? { 'X-Grace-Calls-Remaining': String(graceRemaining) }
          : {};

        return jsonResponse(responsePayload, 200, extraHeaders);
      } catch (profileErr: any) {
        return jsonResponse({ error: 'Twitter Profile Lookup Failed', message: profileErr.message }, 502);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};
