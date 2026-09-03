async function verifyProductionEngine() {
  console.log('\n--- Checking Public Availability & 402 Challenges (v1.3.0) ---\n');

  try {
    const health = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/health');
    console.log(`[HTTP ${health.status}] /health -> ${health.ok ? 'PUBLICLY ACCESSIBLE ✅' : 'FAILED ❌'}`);

    const bazaar = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json');
    console.log(`[HTTP ${bazaar.status}] /.well-known/x402.json -> ${bazaar.ok ? 'PUBLICLY ACCESSIBLE (x402 V2 Bazaar) ✅' : 'FAILED ❌'}`);

    const scrapeRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    console.log(`[HTTP ${scrapeRes.status}] POST /v1/scrape (0.005 USDC) -> ${scrapeRes.status === 402 && scrapeRes.headers.get('x-payment-amount') === '0.005' ? 'VERIFIED $0.005 CHALLENGE ✅' : 'FAILED ❌'}`);

    const digestRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    console.log(`[HTTP ${digestRes.status}] POST /v1/digest (0.025 USDC - Llama 3) -> ${digestRes.status === 402 && digestRes.headers.get('x-payment-amount') === '0.025' ? 'VERIFIED $0.025 CHALLENGE ✅' : 'FAILED ❌'}`);

    const auditRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    console.log(`[HTTP ${auditRes.status}] POST /v1/audit (0.080 USDC - Security) -> ${auditRes.status === 402 && auditRes.headers.get('x-payment-amount') === '0.080' ? 'VERIFIED $0.080 CHALLENGE ✅' : 'FAILED ❌'}`);

    const searchRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'autonomous agents' })
    });
    console.log(`[HTTP ${searchRes.status}] POST /v1/search (0.050 USDC) -> ${searchRes.status === 402 && searchRes.headers.get('x-payment-amount') === '0.050' ? 'VERIFIED $0.050 CHALLENGE ✅' : 'FAILED ❌'}`);

    const twitterSearchRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '$BASE' })
    });
    console.log(`[HTTP ${twitterSearchRes.status}] POST /v1/twitter/search (0.050 USDC) -> ${twitterSearchRes.status === 402 && twitterSearchRes.headers.get('x-payment-amount') === '0.050' ? 'VERIFIED $0.050 CHALLENGE ✅' : 'FAILED ❌'}`);

    const twitterProfileRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/twitter/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'jessepollak' })
    });
    console.log(`[HTTP ${twitterProfileRes.status}] POST /v1/twitter/profile (0.030 USDC) -> ${twitterProfileRes.status === 402 && twitterProfileRes.headers.get('x-payment-amount') === '0.030' ? 'VERIFIED $0.030 CHALLENGE ✅' : 'FAILED ❌'}`);
  } catch (err: any) {
    console.error('Production Verification Error:', err.message);
  }

  console.log('\n---------------------------------------------------------------\n');
}

verifyProductionEngine();
