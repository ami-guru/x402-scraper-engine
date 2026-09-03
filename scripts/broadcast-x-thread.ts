import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.TWITTER_CONSUMER_KEY!;
const API_SECRET = process.env.TWITTER_CONSUMER_SECRET!;
const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN!;
const ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET!;

const TWEETS = [
  // Tweet 1 - Main Hook
  `Autonomous AI agents don't have credit cards. They have wallets.\n\nWe just killed API keys and $50/mo SaaS subscriptions for web scraping.\n\nIntroducing x402 Scraper: the first production HTTP 402 microtransaction scraper for AI agents on @base.\n\n$0.02 USDC/scrape. 2s edge settlement. Zero accounts. 🧵👇`,

  // Tweet 2 - The Friction
  `If you build autonomous agents in Claude Desktop, Cursor, or AutoGPT, you know the headache:\n\n• $50/mo scraper minimums\n• API keys accidentally leaking in git commits\n• Giving an agent human credit card access\n\nIt breaks the entire concept of autonomous agency.`,

  // Tweet 3 - The Protocol
  `We brought back the HTTP 402 specification RFC as it was always intended:\n\n1. Agent calls POST /v1/scrape\n2. Cloudflare Edge returns 402 Payment Required\n3. Agent signs 0.02 USDC on Base via viem\n4. Edge verifies receipt + KV anti-replay\n5. Delivers clean, token-minimized Markdown`,

  // Tweet 4 - Deep Search Addition
  `Need multi-source research instead of a single page?\n\nOur /v1/search endpoint ($0.05 USDC) executes deep web research across multiple sources and extracts clean Markdown summaries in a single call.\n\nReplaces Perplexity / Tavily without any recurring subscription.`,

  // Tweet 5 - Native MCP Integration
  `It ships with native Model Context Protocol (MCP) support for Claude Desktop and Cursor:\n\nInstall in 30 seconds:\n\`npx -y @ami-guru/x402-scraper-engine\`\n\nAgents self-fund, pay micro-cents per tool call, and stream Markdown straight into context.`,

  // Tweet 6 - CTA & Open Source
  `100% open source under MIT.\n\n🌐 Live API: https://x402-scraper-engine.gejoe-tt.workers.dev/health\n💻 GitHub: https://github.com/ami-guru/x402-scraper-engine\n\nTest it with cURL today. Built on @base. 🔵 CC @jessepollak @CoinbaseDev`
];

function generateOAuthHeader(method: string, url: string, params: Record<string, string> = {}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
    ...params
  };

  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString)
  ].join('&');

  const signingKey = `${encodeURIComponent(API_SECRET)}&${encodeURIComponent(ACCESS_SECRET)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`);

  return `OAuth ${headerParts.join(', ')}`;
}

async function postTweet(text: string, replyToId?: string): Promise<{ id: string; text: string }> {
  const url = 'https://api.twitter.com/2/tweets';
  const bodyPayload: any = { text };

  if (replyToId) {
    bodyPayload.reply = { in_reply_to_tweet_id: replyToId };
  }

  const authHeader = generateOAuthHeader('POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  const data: any = await res.json();

  if (!res.ok || !data.data?.id) {
    throw new Error(`X API Error (${res.status} ${res.statusText}): ${JSON.stringify(data)}`);
  }

  return data.data;
}

async function broadcastThread() {
  console.log('\n======================================================');
  console.log('🚀 Broadcasting Viral Launch Thread to @SterlingTrvTech on X');
  console.log('======================================================\n');

  let lastTweetId: string | undefined = undefined;

  for (let i = 0; i < TWEETS.length; i++) {
    const tweetText = TWEETS[i];
    console.log(`[Tweet ${i + 1}/${TWEETS.length}] Posting...`);

    try {
      const posted = await postTweet(tweetText, lastTweetId);
      console.log(`  ✔ Posted! Tweet ID: ${posted.id}`);
      console.log(`  👉 Link: https://x.com/SterlingTrvTech/status/${posted.id}\n`);
      lastTweetId = posted.id;

      // Small delay between thread tweets
      if (i < TWEETS.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err: any) {
      console.error(`  ✖ Failed to post tweet ${i + 1}:`, err.message);
      break;
    }
  }

  if (lastTweetId) {
    console.log('🎉 VIRAL LAUNCH THREAD POSTED SUCCESSFULLY!');
    console.log(`👉 View Thread: https://x.com/SterlingTrvTech/status/${lastTweetId}\n`);
  }
}

broadcastThread();
