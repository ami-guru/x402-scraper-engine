import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function getOAuth1Header(method: string, url: string, params: Record<string, string> = {}): string {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY || '';
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || '';
  const accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || '';

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
    ...params
  };

  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams['oauth_signature'] = signature;

  const authHeader =
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ');

  return authHeader;
}

async function postTweet(text: string) {
  console.log(`🐦 Posting Tweet from @SterlingTrvTech...\nText: "${text}"\n`);
  const url = 'https://api.twitter.com/2/tweets';

  const authHeader = getOAuth1Header('POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const data = await res.json();
  console.log('Twitter Response Status:', res.status);
  console.log('Twitter API Response Data:', JSON.stringify(data, null, 2));
}

const tweetText = `Autonomous AI agents don't have credit cards. They have on-chain wallets.

We killed the $100/mo Twitter API paywall & $50/mo scraper fees for agents on @base:
• 0.005 USDC Markdown Scrape
• 0.025 USDC Llama 3 Synthesis
• 0.050 USDC Twitter Cashtag Search

GitHub: https://github.com/ami-guru/x402-scraper-engine`;

postTweet(tweetText);
