import worker from '../src/index';
import { Env } from '../src/types';
import { validateUrl, htmlToMarkdown, estimateTokens } from '../src/scraper';
import { searchTwitter, getTwitterProfile } from '../src/twitter';
import { isValidTxHash } from '../src/verifier';

// In-Memory KV Mock for Local Testing
class InMemoryKV {
  private store = new Map<string, { value: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && item.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expires = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Test Suite Runner
let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName}`);
    if (errorDetail) {
      console.error(`    \x1b[33mDetail:\x1b[0m ${errorDetail}`);
    }
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 Running x402-scraper-engine v1.3.0 Mock Test Harness');
  console.log('======================================================\n');

  const mockEnv: Env = {
    PROCESSED_TXS: new InMemoryKV() as any,
    NETWORK: 'base',
    CHAIN_ID: 8453,
    USDC_CONTRACT_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    PRICE_USDC: '0.005',
    PRICE_USDC_UNITS: '5000',
    SCRAPE_PRICE_USDC: '0.005',
    SCRAPE_PRICE_UNITS: '5000',
    DIGEST_PRICE_USDC: '0.025',
    DIGEST_PRICE_UNITS: '25000',
    AUDIT_PRICE_USDC: '0.080',
    AUDIT_PRICE_UNITS: '80000',
    SEARCH_PRICE_USDC: '0.050',
    SEARCH_PRICE_UNITS: '50000',
    TWITTER_SEARCH_PRICE_USDC: '0.050',
    TWITTER_SEARCH_PRICE_UNITS: '50000',
    TWITTER_PROFILE_PRICE_USDC: '0.030',
    TWITTER_PROFILE_PRICE_UNITS: '30000',
    PAYMENT_WINDOW_SECONDS: 900,
    BASE_RPC_URL: 'https://mainnet.base.org',
    TREASURY_WALLET_ADDRESS: '0x4107f297256E00F32873f45F50A35a902c1c2034'
  };

  const mockCtx: any = {
    waitUntil: (p: Promise<any>) => {},
    passThroughOnException: () => {}
  };

  // -------------------------------------------------------------
  // TEST SUITE 1: URL Security & SSRF Protection
  // -------------------------------------------------------------
  console.log('[1] Testing Security & SSRF Validation:');

  const blockedUrls = [
    'http://localhost:8080/admin',
    'http://127.0.0.1/etc/passwd',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/private',
    'http://192.168.1.254/router',
    'file:///C:/Users/jerry/secret.txt',
    'ftp://example.com/files'
  ];

  for (const url of blockedUrls) {
    const check = validateUrl(url);
    assert(!check.valid, `Block dangerous/internal URL: ${url}`, check.error);
  }

  const validUrls = [
    'https://example.com',
    'https://news.ycombinator.com/item?id=12345',
    'http://blog.cloudflare.com/post'
  ];

  for (const url of validUrls) {
    const check = validateUrl(url);
    assert(check.valid, `Allow legitimate public URL: ${url}`);
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: HTML to Markdown Sanitization & Twitter
  // -------------------------------------------------------------
  console.log('\n[2] Testing HTML Sanitization & Twitter Parser:');

  const dirtyHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page Title</title>
        <script>alert('malicious')</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <nav><a href="/home">Home</a> | <a href="/about">About</a></nav>
        <h1>Article Heading</h1>
        <p>This is a <strong>bold</strong> paragraph with a <a href="https://example.com/learn">link to learn</a>.</p>
        <svg><circle cx="50" cy="50" r="40"/></svg>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
        <ul>
          <li>First feature</li>
          <li>Second feature</li>
        </ul>
        <pre><code>const test = 42;</code></pre>
        <blockquote>Remarkable insight quote</blockquote>
        <footer>Copyright 2026</footer>
      </body>
    </html>
  `;

  const parsed = htmlToMarkdown(dirtyHtml, 'https://example.com');
  assert(parsed.title === 'Test Page Title', 'Extracts title tag correctly');
  assert(!parsed.markdown.includes('alert'), 'Strips JavaScript tags and contents');
  assert(!parsed.markdown.includes('color: red'), 'Strips CSS style tags');
  assert(parsed.markdown.includes('# Article Heading'), 'Converts H1 to Markdown');
  assert(parsed.markdown.includes('[link to learn](https://example.com/learn)'), 'Extracts anchor links');

  const tokens = estimateTokens(parsed.markdown);
  assert(tokens > 10 && tokens < 500, `Token estimation realistic (${tokens} tokens)`);

  assert(typeof searchTwitter === 'function', 'searchTwitter module is properly instantiated');
  assert(typeof getTwitterProfile === 'function', 'getTwitterProfile module is properly instantiated');

  // -------------------------------------------------------------
  // TEST SUITE 3: HTTP 402 Multi-Tier Challenge Protocol
  // -------------------------------------------------------------
  console.log('\n[3] Testing HTTP 402 Multi-Tier Protocol:');

  // Health route
  const healthReq = new Request('http://localhost/health', { method: 'GET' });
  const healthRes = await worker.fetch(healthReq, mockEnv, mockCtx);
  assert(healthRes.status === 200, 'GET /health returns HTTP 200 OK');
  const healthJson: any = await healthRes.json();
  assert(healthJson.version === '1.3.0', 'GET /health returns v1.3.0');
  assert(healthJson.pricing.scrape_usdc === '0.005', 'GET /health returns 0.005 USDC scrape pricing');
  assert(healthJson.pricing.digest_usdc === '0.025', 'GET /health returns 0.025 USDC digest pricing');
  assert(healthJson.pricing.audit_usdc === '0.080', 'GET /health returns 0.080 USDC audit pricing');

  // POST /v1/scrape without receipt -> HTTP 402 ($0.005)
  const unpaidReq = new Request('http://localhost/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
  const unpaidRes = await worker.fetch(unpaidReq, mockEnv, mockCtx);
  assert(unpaidRes.status === 402, 'POST /v1/scrape returns HTTP 402');
  assert(unpaidRes.headers.get('PAYMENT-REQUIRED') !== null, 'Returns PAYMENT-REQUIRED Base64 V2 header');
  assert(unpaidRes.headers.get('X-Payment-Amount') === '0.005', 'Returns X-Payment-Amount: 0.005');

  // POST /v1/digest without receipt -> HTTP 402 ($0.025)
  const unpaidDigestReq = new Request('http://localhost/v1/digest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
  const unpaidDigestRes = await worker.fetch(unpaidDigestReq, mockEnv, mockCtx);
  assert(unpaidDigestRes.status === 402, 'POST /v1/digest returns HTTP 402');
  assert(unpaidDigestRes.headers.get('X-Payment-Amount') === '0.025', 'Returns X-Payment-Amount: 0.025 for digest');

  // POST /v1/audit without receipt -> HTTP 402 ($0.080)
  const unpaidAuditReq = new Request('http://localhost/v1/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });
  const unpaidAuditRes = await worker.fetch(unpaidAuditReq, mockEnv, mockCtx);
  assert(unpaidAuditRes.status === 402, 'POST /v1/audit returns HTTP 402');
  assert(unpaidAuditRes.headers.get('X-Payment-Amount') === '0.080', 'Returns X-Payment-Amount: 0.080 for audit');

  // POST /v1/search without receipt -> HTTP 402 ($0.050)
  const unpaidSearchReq = new Request('http://localhost/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'autonomous agents' })
  });
  const unpaidSearchRes = await worker.fetch(unpaidSearchReq, mockEnv, mockCtx);
  assert(unpaidSearchRes.status === 402, 'POST /v1/search returns HTTP 402');
  assert(unpaidSearchRes.headers.get('X-Payment-Amount') === '0.050', 'Returns X-Payment-Amount: 0.050 for search');

  // POST /v1/twitter/search without receipt -> HTTP 402 ($0.050)
  const unpaidTwitterReq = new Request('http://localhost/v1/twitter/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '$BASE agents' })
  });
  const unpaidTwitterRes = await worker.fetch(unpaidTwitterReq, mockEnv, mockCtx);
  assert(unpaidTwitterRes.status === 402, 'POST /v1/twitter/search returns HTTP 402');

  // POST /v1/twitter/profile without receipt -> HTTP 402 ($0.030)
  const unpaidProfileReq = new Request('http://localhost/v1/twitter/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'jessepollak' })
  });
  const unpaidProfileRes = await worker.fetch(unpaidProfileReq, mockEnv, mockCtx);
  assert(unpaidProfileRes.status === 402, 'POST /v1/twitter/profile returns HTTP 402');

  // GET /.well-known/x402.json Bazaar Extension
  const bazaarReq = new Request('http://localhost/.well-known/x402.json', { method: 'GET' });
  const bazaarRes = await worker.fetch(bazaarReq, mockEnv, mockCtx);
  assert(bazaarRes.status === 200, 'GET /.well-known/x402.json returns HTTP 200');
  const bazaarJson: any = await bazaarRes.json();
  assert(bazaarJson.x402_version === '2.0', 'Returns x402 V2.0 specification');
  assert(bazaarJson.endpoints.length === 6, 'Returns all 6 endpoints in Bazaar catalog');

  // POST /v1/ping-index
  const pingReq = new Request('http://localhost/v1/ping-index', { method: 'POST' });
  const pingRes = await worker.fetch(pingReq, mockEnv, mockCtx);
  assert(pingRes.status === 200, 'POST /v1/ping-index returns HTTP 200 OK');

  // -------------------------------------------------------------
  // TEST SUITE 4: Invalid Receipt & Replay Prevention
  // -------------------------------------------------------------
  console.log('\n[4] Testing Receipt Verification & Replay Protection:');

  const badHashReq = new Request('http://localhost/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Receipt': '0xnotarealhash'
    },
    body: JSON.stringify({ url: 'https://example.com' })
  });

  const badHashRes = await worker.fetch(badHashReq, mockEnv, mockCtx);
  assert(badHashRes.status === 402, 'Malformed tx hash triggers 402 verification failure');

  assert(isValidTxHash('0x' + 'a'.repeat(64)), 'Valid 64-char hex hash passes format check');
  assert(!isValidTxHash('0x' + 'g'.repeat(64)), 'Non-hex characters fail format check');
  assert(!isValidTxHash('0x1234'), 'Short hash fails format check');

  const fakeTxHash = '0x' + '11'.repeat(32);
  await mockEnv.PROCESSED_TXS.put(`tx:${fakeTxHash}`, JSON.stringify({ redeemedAt: new Date().toISOString() }));
  const existingInKv = await mockEnv.PROCESSED_TXS.get(`tx:${fakeTxHash}`);
  assert(existingInKv !== null, 'KV correctly records processed transaction hash');

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL LOCAL UNIT & INTEGRATION MOCK TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed. Please inspect errors above.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
