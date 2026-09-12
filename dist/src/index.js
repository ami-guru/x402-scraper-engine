import { validateUrl, scrapeToMarkdown, searchAndScrapeToMarkdown } from './scraper';
import { synthesizeDigest, auditSecuritySignal } from './digest';
import { searchTwitter, getTwitterProfile } from './twitter';
import { verifyBasePayment, checkAndRecordReplay, createStandardPaymentChallenge } from './verifier';
import { pingPublicIndexers } from './discovery';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment-Receipt, X-Payment-Version, X-Payment-Network, PAYMENT-REQUIRED, Payment-Required, PAYMENT-SIGNATURE, payment-signature',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, Payment-Required, PAYMENT-RESPONSE, Payment-Response, X-Payment-Version, X-Payment-Network, X-Payment-Chain-Id, X-Payment-Asset, X-Payment-Asset-Address, X-Payment-Amount, X-Payment-To, X-Payment-Window, X-Grace-Calls-Remaining'
};
async function settleFacilitatorPayment(paymentSignatureB64, requirements) {
    try {
        const rawJson = typeof atob === 'function' ? atob(paymentSignatureB64) : Buffer.from(paymentSignatureB64, 'base64').toString('utf-8');
        const paymentPayload = JSON.parse(rawJson);
        const settleResp = await fetch('https://facilitator.payai.network/settle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'x402-Scraper-Worker/1.4.1' },
            body: JSON.stringify({
                paymentPayload,
                paymentRequirements: requirements
            })
        });
        if (!settleResp.ok) {
            const errText = await settleResp.text();
            return { valid: false, error: `Facilitator settlement returned HTTP ${settleResp.status}: ${errText}` };
        }
        const resJson = await settleResp.json();
        if (resJson.success && resJson.transaction) {
            return { valid: true, txHash: resJson.transaction, payer: resJson.payer };
        }
        else {
            return { valid: false, error: resJson.errorReason || resJson.invalidReason || 'Settlement failed on facilitator' };
        }
    }
    catch (err) {
        return { valid: false, error: `Failed to process PAYMENT-SIGNATURE: ${err.message}` };
    }
}
function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
            ...extraHeaders
        }
    });
}
async function checkAndConsumeGraceTier(request, env) {
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
    }
    catch (err) {
        return { isGrace: false, remaining: 0 };
    }
}
async function recordUsageMetric(env, endpoint, isPaid, usdcAmount) {
    if (!env.PROCESSED_TXS)
        return;
    try {
        const raw = await env.PROCESSED_TXS.get('metric:stats');
        let stats = raw
            ? JSON.parse(raw)
            : {
                total_calls: 0,
                free_grace_calls: 0,
                paid_calls: 0,
                usdc_revenue: 0,
                endpoints: {
                    scrape: 0,
                    digest: 0,
                    audit: 0,
                    search: 0,
                    twitter_search: 0,
                    twitter_profile: 0
                },
                last_call_at: null
            };
        stats.total_calls = (stats.total_calls || 0) + 1;
        if (isPaid) {
            stats.paid_calls = (stats.paid_calls || 0) + 1;
            stats.usdc_revenue = Number(((stats.usdc_revenue || 0) + usdcAmount).toFixed(6));
        }
        else {
            stats.free_grace_calls = (stats.free_grace_calls || 0) + 1;
        }
        if (!stats.endpoints) {
            stats.endpoints = { scrape: 0, digest: 0, audit: 0, search: 0, twitter_search: 0, twitter_profile: 0 };
        }
        stats.endpoints[endpoint] = (stats.endpoints[endpoint] || 0) + 1;
        stats.last_call_at = new Date().toISOString();
        await env.PROCESSED_TXS.put('metric:stats', JSON.stringify(stats));
    }
    catch (err) {
        console.error('recordUsageMetric error:', err);
    }
}
function getOpenApiSpec(origin, env) {
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
            },
            '/v1/stats': {
                get: {
                    summary: 'Global engine usage and settlement metrics',
                    description: 'Returns real-time counters of total calls, free grace tier usage, paid on-chain settlements, and USDC revenue.',
                    responses: {
                        '200': { description: 'Live usage statistics' }
                    }
                }
            }
        }
    };
}
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        // 1. Handle CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }
        // 2. Health, OpenAPI, llms.txt & Manifest Discovery Routes
        if (request.method === 'GET') {
            if (url.pathname === '/v1/stats' || url.pathname === '/metrics') {
                let stats = null;
                if (env.PROCESSED_TXS) {
                    try {
                        const raw = await env.PROCESSED_TXS.get('metric:stats');
                        if (raw)
                            stats = JSON.parse(raw);
                    }
                    catch (e) {
                        // ignore
                    }
                }
                return jsonResponse({
                    service: 'x402-scraper-engine',
                    version: '1.4.1',
                    status: 'operational',
                    stats: stats || {
                        total_calls: 0,
                        free_grace_calls: 0,
                        paid_calls: 0,
                        usdc_revenue: 0,
                        endpoints: {
                            scrape: 0,
                            digest: 0,
                            audit: 0,
                            search: 0,
                            twitter_search: 0,
                            twitter_profile: 0
                        },
                        last_call_at: null
                    },
                    protocol: 'x402',
                    network: env.NETWORK || 'base',
                    chain_id: Number(env.CHAIN_ID || 8453),
                    asset: 'USDC',
                    treasury: env.TREASURY_WALLET_ADDRESS,
                    timestamp: new Date().toISOString()
                });
            }
            if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/v1/info') {
                let liveStats = null;
                if (env.PROCESSED_TXS) {
                    try {
                        const raw = await env.PROCESSED_TXS.get('metric:stats');
                        if (raw)
                            liveStats = JSON.parse(raw);
                    }
                    catch (e) {
                        // ignore
                    }
                }
                return jsonResponse({
                    service: 'x402-scraper-engine',
                    status: 'operational',
                    version: '1.4.1',
                    description: 'HTTP 402 Multi-Tier Agent Intelligence, Edge LLM Digest, Security Audit & Web Scraper for AI Agents on Base L2',
                    free_grace_calls: 2,
                    stats: liveStats || {
                        total_calls: 0,
                        free_grace_calls: 0,
                        paid_calls: 0,
                        usdc_revenue: 0
                    },
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
                    stats_url: `${url.origin}/v1/stats`,
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
npx -y github:ami-guru/x402-scraper-engine
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
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
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
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.SCRAPE_PRICE_USDC || env.PRICE_USDC || '0.005';
            const amountUnits = env.SCRAPE_PRICE_UNITS || '5000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/scrape`,
                resourceDescription: 'Zero-bloat HTML to Markdown extraction for token-efficient LLM context on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['scraper', 'markdown', 'web3', 'base', 'usdc'],
                inputBody: { url: 'https://example.com' },
                inputProperties: { url: { type: 'string', format: 'uri' } },
                inputRequired: ['url'],
                outputExample: {
                    success: true,
                    url: 'https://example.com',
                    title: 'Example Domain',
                    markdown: '# Example Domain\n\nThis domain is for illustrative examples.',
                    tokens_estimated: 50,
                    payment: { tx_hash: '0x...', amount: '0.005', asset: 'USDC' }
                }
            });
            const paymentHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, paymentHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, paymentHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'scrape',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = BigInt(amountUnits);
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
                }
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'scrape',
                    sender: verification.sender,
                    amountUnits: verification.amountUnits?.toString(),
                    timestamp: verification.timestamp
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                settledAt = new Date(verification.timestamp * 1000).toISOString();
            }
            try {
                const scrapeResult = await scrapeToMarkdown(body.url);
                const responsePayload = {
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
                        }
                        : {
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'scrape', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (scrapeErr) {
                return jsonResponse({ error: 'Scrape Execution Failed', message: scrapeErr.message }, 502);
            }
        }
        // 4. POST /v1/digest Route (0.025 USDC - Llama 3 Edge Synthesis)
        if (request.method === 'POST' && url.pathname === '/v1/digest') {
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
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
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.DIGEST_PRICE_USDC || '0.025';
            const amountUnits = env.DIGEST_PRICE_UNITS || '25000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/digest`,
                resourceDescription: 'Edge LLM Context Synthesis (Llama-3-8B) extracting executive summary, key takeaways & structured entities on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['ai-synthesis', 'llama3', 'context-compression', 'digest', 'base', 'usdc'],
                inputBody: { url: 'https://example.com', prompt: 'Summarize key points' },
                inputProperties: { url: { type: 'string', format: 'uri' }, prompt: { type: 'string' } },
                inputRequired: ['url'],
                outputExample: {
                    success: true,
                    url: 'https://example.com',
                    title: 'Example Domain',
                    digest: 'Executive Summary: ...',
                    model: '@cf/meta/llama-3-8b-instruct',
                    latency_ms: 320,
                    payment: { tx_hash: '0x...', amount: '0.025', asset: 'USDC' }
                }
            });
            const paymentHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, paymentHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, paymentHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'digest',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = BigInt(amountUnits);
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
                }
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'digest',
                    sender: verification.sender,
                    amountUnits: verification.amountUnits?.toString(),
                    timestamp: verification.timestamp
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                settledAt = new Date(verification.timestamp * 1000).toISOString();
            }
            try {
                const digestResult = await synthesizeDigest(body.url, env, body.focus);
                const responsePayload = {
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
                        }
                        : {
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'digest', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (digestErr) {
                return jsonResponse({ error: 'Digest Synthesis Failed', message: digestErr.message }, 502);
            }
        }
        // 5. POST /v1/audit Route (0.080 USDC - Security Signal Audit)
        if (request.method === 'POST' && url.pathname === '/v1/audit') {
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
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
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.AUDIT_PRICE_USDC || '0.080';
            const amountUnits = env.AUDIT_PRICE_UNITS || '80000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/audit`,
                resourceDescription: 'Security, credibility, and phishing risk analysis for web domains and smart contracts on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['security', 'audit', 'credibility', 'risk-analysis', 'base', 'usdc'],
                inputBody: { url: 'https://example.com' },
                inputProperties: { url: { type: 'string', format: 'uri' } },
                inputRequired: ['url'],
                outputExample: {
                    success: true,
                    url: 'https://example.com',
                    title: 'Example Domain',
                    credibility_score: 95,
                    risk_level: 'low',
                    security_flags: [],
                    credibility_analysis: 'Domain is authoritative and established.',
                    technical_signals: { has_ssl: true },
                    markdown: '# Audit Report\n\nSecurity Status: Clear',
                    tokens_estimated: 120,
                    payment: { tx_hash: '0x...', amount: '0.080', asset: 'USDC' }
                }
            });
            const paymentHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, paymentHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, paymentHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'audit',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = BigInt(amountUnits);
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, paymentHeaders);
                }
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    targetUrl: body.url,
                    action: 'audit',
                    sender: verification.sender,
                    amountUnits: verification.amountUnits?.toString(),
                    timestamp: verification.timestamp
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                settledAt = new Date(verification.timestamp * 1000).toISOString();
            }
            try {
                const auditResult = await auditSecuritySignal(body.url, env, body.contract_address);
                const responsePayload = {
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
                        }
                        : {
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'audit', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (auditErr) {
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
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
                return jsonResponse({ error: 'Invalid JSON body. Expected { "query": "..." }' }, 400);
            }
            if (!body || !body.query || !body.query.trim()) {
                return jsonResponse({ error: 'Missing required field: "query"' }, 400);
            }
            const receiptHeader = request.headers.get('X-Payment-Receipt');
            const authHeader = request.headers.get('Authorization');
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.SEARCH_PRICE_USDC || '0.050';
            const amountUnits = env.SEARCH_PRICE_UNITS || '50000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/search`,
                resourceDescription: 'Multi-source deep web research and synthesized Markdown extraction on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['search', 'deep-research', 'web', 'base', 'usdc'],
                inputBody: { query: 'crypto agents', limit: 5 },
                inputProperties: { query: { type: 'string' }, limit: { type: 'integer' } },
                inputRequired: ['query'],
                outputExample: {
                    success: true,
                    query: 'crypto agents',
                    total_results: 5,
                    results: [],
                    tokens_estimated: 150,
                    payment: { tx_hash: '0x...', amount: '0.050', asset: 'USDC' }
                }
            });
            const searchPaymentHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, searchPaymentHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, searchPaymentHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    query: body.query,
                    action: 'search',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction has already been redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = BigInt(amountUnits);
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, searchPaymentHeaders);
                }
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    query: body.query,
                    action: 'search',
                    sender: verification.sender,
                    amountUnits: verification.amountUnits?.toString(),
                    timestamp: verification.timestamp
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction has already been redeemed.' }, 400);
                }
                settledAt = new Date(verification.timestamp * 1000).toISOString();
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
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'search', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (searchErr) {
                return jsonResponse({ error: 'Search Execution Failed', message: searchErr.message || 'Failed to execute web search.' }, 502);
            }
        }
        // 8. POST /v1/twitter/search Route ($0.05 USDC)
        if (request.method === 'POST' && url.pathname === '/v1/twitter/search') {
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
                return jsonResponse({ error: 'Invalid JSON body. Expected { "query": "..." }' }, 400);
            }
            if (!body || !body.query || !body.query.trim()) {
                return jsonResponse({ error: 'Missing required field: "query"' }, 400);
            }
            const receiptHeader = request.headers.get('X-Payment-Receipt');
            const authHeader = request.headers.get('Authorization');
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.TWITTER_SEARCH_PRICE_USDC || '0.050';
            const amountUnits = env.TWITTER_SEARCH_PRICE_UNITS || '50000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/twitter/search`,
                resourceDescription: 'Cashtag and keyword Twitter search with real-time sentiment extraction on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['twitter', 'sentiment', 'social', 'base', 'usdc'],
                inputBody: { query: '$BASE', maxResults: 10 },
                inputProperties: { query: { type: 'string' }, maxResults: { type: 'integer' } },
                inputRequired: ['query'],
                outputExample: {
                    success: true,
                    query: '$BASE',
                    tweets: [],
                    tokens_estimated: 100,
                    payment: { tx_hash: '0x...', amount: '0.050', asset: 'USDC' }
                }
            });
            const twitterHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, twitterHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, twitterHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    query: body.query,
                    action: 'twitter_search',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = BigInt(amountUnits);
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, twitterHeaders);
                }
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
                settledAt = new Date(verification.timestamp * 1000).toISOString();
            }
            try {
                const twitterResult = await searchTwitter(body.query, body.limit || 5);
                const responsePayload = {
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
                        }
                        : {
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'twitter_search', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (twitterErr) {
                return jsonResponse({ error: 'Twitter Search Failed', message: twitterErr.message }, 502);
            }
        }
        // 9. POST /v1/twitter/profile Route ($0.03 USDC)
        if (request.method === 'POST' && url.pathname === '/v1/twitter/profile') {
            let body;
            try {
                body = await request.json();
            }
            catch (e) {
                return jsonResponse({ error: 'Invalid JSON body. Expected { "username": "..." }' }, 400);
            }
            if (!body || !body.username || !body.username.trim()) {
                return jsonResponse({ error: 'Missing required field: "username"' }, 400);
            }
            const receiptHeader = request.headers.get('X-Payment-Receipt');
            const authHeader = request.headers.get('Authorization');
            const paymentSignature = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
            let txHash = receiptHeader?.trim();
            if (!txHash && authHeader && authHeader.startsWith('Bearer ')) {
                txHash = authHeader.substring(7).trim();
            }
            const amountUsdc = env.TWITTER_PROFILE_PRICE_USDC || '0.030';
            const amountUnits = env.TWITTER_PROFILE_PRICE_UNITS || '30000';
            const challenge = createStandardPaymentChallenge({
                amountUsdc,
                amountUnits,
                recipient: env.TREASURY_WALLET_ADDRESS,
                network: env.NETWORK || 'base',
                chainId: env.CHAIN_ID || 8453,
                contractAddress: env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                windowSeconds: env.PAYMENT_WINDOW_SECONDS || 900,
                resourceUrl: `${url.origin}/v1/twitter/profile`,
                resourceDescription: 'Twitter/X user profile and recent tweet timeline extraction on Base L2',
                serviceName: 'x402 Scraper Engine',
                tags: ['twitter', 'profile', 'social', 'base', 'usdc'],
                inputBody: { username: 'base' },
                inputProperties: { username: { type: 'string' } },
                inputRequired: ['username'],
                outputExample: {
                    success: true,
                    username: 'base',
                    bio: 'Base is a secure, low-cost, builder-friendly Ethereum L2.',
                    tweets: [],
                    tokens_estimated: 100,
                    payment: { tx_hash: '0x...', amount: '0.030', asset: 'USDC' }
                }
            });
            const profileHeaders = challenge.headers;
            let isGraceCall = false;
            let graceRemaining = 0;
            let paymentResponseHeaders = {};
            if (!txHash && !paymentSignature) {
                const grace = await checkAndConsumeGraceTier(request, env);
                if (grace.isGrace) {
                    isGraceCall = true;
                    graceRemaining = grace.remaining;
                }
                else {
                    return jsonResponse(challenge.responseBody, 402, profileHeaders);
                }
            }
            let settledAt = new Date().toISOString();
            if (paymentSignature) {
                const settle = await settleFacilitatorPayment(paymentSignature, challenge.standardPayload.accepts[0]);
                if (!settle.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: settle.error }, 402, profileHeaders);
                }
                txHash = settle.txHash;
                const replayCheck = await checkAndRecordReplay(txHash, env, {
                    username: body.username,
                    action: 'twitter_profile',
                    sender: settle.payer,
                    amountUnits,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                if (replayCheck.replayed) {
                    return jsonResponse({ error: 'Replay Detected', message: replayCheck.error || 'Transaction already redeemed.' }, 400);
                }
                const b64Resp = typeof btoa === 'function' ? btoa(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })) : Buffer.from(JSON.stringify({ success: true, transaction: txHash, network: 'eip155:8453', payer: settle.payer })).toString('base64');
                paymentResponseHeaders = { 'PAYMENT-RESPONSE': b64Resp };
                settledAt = new Date().toISOString();
            }
            else if (!isGraceCall) {
                const requiredUnits = env.TWITTER_PROFILE_PRICE_UNITS ? BigInt(env.TWITTER_PROFILE_PRICE_UNITS) : 30000n;
                const verification = await verifyBasePayment(txHash, env, requiredUnits);
                if (!verification.valid) {
                    return jsonResponse({ error: 'Payment Verification Failed', details: verification.error }, 402, profileHeaders);
                }
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
                settledAt = new Date(verification.timestamp * 1000).toISOString();
            }
            try {
                const profileResult = await getTwitterProfile(body.username);
                const responsePayload = {
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
                        }
                        : {
                            tx_hash: txHash,
                            network: env.NETWORK || 'base',
                            amount: amountUsdc,
                            asset: 'USDC',
                            settled_at: settledAt
                        }
                };
                const extraHeaders = {
                    ...paymentResponseHeaders,
                    ...(isGraceCall ? { 'X-Grace-Calls-Remaining': String(graceRemaining) } : {})
                };
                ctx.waitUntil(recordUsageMetric(env, 'twitter_profile', !isGraceCall, Number(amountUsdc)));
                return jsonResponse(responsePayload, 200, extraHeaders);
            }
            catch (profileErr) {
                return jsonResponse({ error: 'Twitter Profile Lookup Failed', message: profileErr.message }, 502);
            }
        }
        return jsonResponse({ error: 'Not Found' }, 404);
    }
};
