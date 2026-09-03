async function checkPublicAvailability() {
  const urls = [
    'https://x402-scraper-engine.gejoe-tt.workers.dev/health',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/ai-plugin.json',
    'https://github.com/ami-guru/x402-scraper-engine'
  ];

  console.log('\n--- Checking Public Availability Worldwide ---\n');

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      console.log(`[HTTP ${res.status}] ${url} -> ${res.ok ? 'PUBLICLY ACCESSIBLE ✅' : 'NOT ACCESSIBLE ❌'}`);
    } catch (e: any) {
      console.log(`[ERROR] ${url} -> ${e.message} ❌`);
    }
  }

  // Also test a POST 402 challenge anonymously without auth
  try {
    const postRes = await fetch('https://x402-scraper-engine.gejoe-tt.workers.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    console.log(`\n[HTTP ${postRes.status}] POST /v1/scrape (Anonymous 402 Challenge) -> ${postRes.status === 402 ? 'PUBLICLY WORKING 402 PROTOCOL ✅' : 'FAILED ❌'}`);
  } catch (e: any) {
    console.log(`\n[ERROR] POST /v1/scrape -> ${e.message} ❌`);
  }

  console.log('\n----------------------------------------------\n');
}

checkPublicAvailability();
