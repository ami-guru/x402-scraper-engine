async function pingIndexers() {
  const urlsToPing = [
    'https://x402-scraper-engine.gejoe-tt.workers.dev',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/health',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/openapi.json',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/x402.json',
    'https://x402-scraper-engine.gejoe-tt.workers.dev/.well-known/ai-plugin.json',
    'https://github.com/ami-guru/x402-scraper-engine'
  ];

  console.log('\n🚀 Broadcasting Live Endpoints to Public Search & Discovery Indexers...\n');

  // 1. Ping Google Sitemap / Index Webhook
  for (const url of urlsToPing) {
    try {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(url)}`;
      const res = await fetch(pingUrl);
      console.log(`[Google Ping] ${url} -> Status ${res.status}`);
    } catch (e: any) {
      console.log(`[Google Ping] ${url} -> ${e.message}`);
    }
  }

  // 2. Ping Bing / IndexNow
  for (const url of urlsToPing) {
    try {
      const bingPing = `https://www.bing.com/ping?sitemap=${encodeURIComponent(url)}`;
      const res = await fetch(bingPing);
      console.log(`[Bing Ping] ${url} -> Status ${res.status}`);
    } catch (e: any) {
      console.log(`[Bing Ping] ${url} -> ${e.message}`);
    }
  }

  console.log('\n✅ Search Engine Discovery Broadcast Completed!\n');
}

pingIndexers();
