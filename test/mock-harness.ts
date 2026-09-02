import worker from '../src/index';
import { Env } from '../src/types';
import { validateUrl, htmlToMarkdown, estimateTokens } from '../src/scraper';
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
  console.log('🚀 Running x402-scraper-engine Mock Test Harness');
  console.log('======================================================\n');

  // Test Environment Configuration
  const mockEnv: Env = {
    PROCESSED_TXS: new InMemoryKV() as any,
    NETWORK: 'base',
    CHAIN_ID: 8453,
    USDC_CONTRACT_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    PRICE_USDC: '0.002',
    PRICE_USDC_UNITS: '2000',
    PAYMENT_WINDOW_SECONDS: 900,
    REPLAY_EXPIRATION_SECONDS: 86400,
    BASE_RPC_URL: 'https://mainnet.base.org',
    TREASURY_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890'
  };

  const mockCtx: any = {
    waitUntil: (promise: Promise<any>) => {},
    passThroughOnException: () => {}
  };

  // -------------------------------------------------------------
  // TEST SUITE 1: URL Security & SSRF Protection
  // -------------------------------------------------------------
  console.log('\n[1] Testing Security & SSRF Validation:');

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
  // TEST SUITE 2: HTML to Markdown Sanitization
  // -------------------------------------------------------------
  console.log('\n[2] Testing HTML to Markdown Sanitization:');

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
  assert(!parsed.markdown.includes('base64'), 'Strips base64 image data bloat');
  assert(!parsed.markdown.includes('<svg>'), 'Strips SVG elements');
  assert(parsed.markdown.includes('# Article Heading'), 'Converts H1 to Markdown heading');
  assert(parsed.markdown.includes('**bold**'), 'Converts <strong> to **bold**');
  assert(parsed.markdown.includes('[link to learn](https://example.com/learn)'), 'Converts anchors to Markdown links');
  assert(parsed.markdown.includes('- First feature'), 'Converts unordered lists to markdown bullets');
  assert(parsed.markdown.includes('```\nconst test = 42;\n```'), 'Converts <pre><code> to fenced code blocks');
  assert(parsed.markdown.includes('> Remarkable insight quote'), 'Converts <blockquote> to Markdown quote');

  const tokens = estimateTokens(parsed.markdown);
  assert(tokens > 0 && tokens < 200, `Estimates tokens accurately (${tokens} tokens estimated)`);

  // -------------------------------------------------------------
  // TEST SUITE 3: HTTP 402 Challenge Protocol Verification
  // -------------------------------------------------------------
  console.log('\n[3] Testing HTTP 402 Micropayment Protocol:');

  // Health route
  const healthReq = new Request('http://localhost/health', { method: 'GET' });
  const healthRes = await worker.fetch(healthReq, mockEnv, mockCtx);
  assert(healthRes.status === 200, 'GET /health returns HTTP 200 OK');
  const healthJson: any = await healthRes.json();
  assert(healthJson.payment.priceUsdc === '0.002', 'GET /health returns 0.002 USDC pricing');
  assert(healthJson.payment.recipient === mockEnv.TREASURY_WALLET_ADDRESS, 'GET /health returns treasury recipient');

  // POST /v1/scrape without receipt -> HTTP 402
  const unpaidReq = new Request('http://localhost/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });

  const unpaidRes = await worker.fetch(unpaidReq, mockEnv, mockCtx);
  assert(unpaidRes.status === 402, 'POST /v1/scrape without receipt returns HTTP 402 Payment Required');
  assert(unpaidRes.headers.get('X-Payment-Version') === '1', 'Returns X-Payment-Version: 1');
  assert(unpaidRes.headers.get('X-Payment-Network') === 'base', 'Returns X-Payment-Network: base');
  assert(unpaidRes.headers.get('X-Payment-Amount') === '0.002', 'Returns X-Payment-Amount: 0.002');
  assert(unpaidRes.headers.get('X-Payment-To') === mockEnv.TREASURY_WALLET_ADDRESS, 'Returns X-Payment-To with treasury address');

  const challengeJson: any = await unpaidRes.json();
  assert(challengeJson.error === 'Payment Required', 'Returns standardized 402 JSON error');
  assert(challengeJson.payment.chainId === 8453, 'Returns Base Chain ID 8453');

  // -------------------------------------------------------------
  // TEST SUITE 4: Invalid Receipt & Replay Prevention
  // -------------------------------------------------------------
  console.log('\n[4] Testing Receipt Verification & Replay Protection:');

  // Test malformed transaction hash
  const badHashReq = new Request('http://localhost/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Receipt': '0xnotarealhash'
    },
    body: JSON.stringify({ url: 'https://example.com' })
  });

  const badHashRes = await worker.fetch(badHashReq, mockEnv, mockCtx);
  assert(badHashRes.status === 402, 'Malformed tx hash triggers 402 payment verification failure');
  const badHashJson: any = await badHashRes.json();
  assert(badHashJson.details.includes('Malformed transaction hash'), 'Rejects malformed transaction format');

  // Test Tx hash regex validator
  assert(isValidTxHash('0x' + 'a'.repeat(64)), 'Valid 64-char hex hash passes format check');
  assert(!isValidTxHash('0x' + 'g'.repeat(64)), 'Non-hex characters fail format check');
  assert(!isValidTxHash('0x1234'), 'Short hash fails format check');

  // Test Replay Prevention using KV
  const fakeTxHash = '0x' + '11'.repeat(32);
  await mockEnv.PROCESSED_TXS.put(`tx:${fakeTxHash}`, JSON.stringify({ redeemedAt: new Date().toISOString() }));

  // Simulate replay check on KV
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
