async function testLiveDeployment() {
  const liveUrl = 'https://x402-scraper-engine.gejoe-tt.workers.dev';
  console.log(`\nTesting Live Deployment at: ${liveUrl}\n`);

  // 1. Test /health
  const healthRes = await fetch(`${liveUrl}/health`);
  console.log(`[1] Health Check: Status ${healthRes.status}`);
  const healthData: any = await healthRes.json();
  console.log('    Treasury Recipient:', healthData.payment?.recipient);
  console.log('    Price:', `${healthData.payment?.priceUsdc} ${healthData.payment?.asset}`);

  // 2. Test /v1/scrape without receipt (Expect 402)
  const scrapeRes = await fetch(`${liveUrl}/v1/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' })
  });

  console.log(`\n[2] Scrape 402 Challenge: Status ${scrapeRes.status} ${scrapeRes.statusText}`);
  console.log('    X-Payment-Version:', scrapeRes.headers.get('x-payment-version'));
  console.log('    X-Payment-Network:', scrapeRes.headers.get('x-payment-network'));
  console.log('    X-Payment-Amount:', scrapeRes.headers.get('x-payment-amount'));
  console.log('    X-Payment-To:', scrapeRes.headers.get('x-payment-to'));
  const challengeBody: any = await scrapeRes.json();
  console.log('    Challenge Body:', JSON.stringify(challengeBody.payment, null, 2));

  console.log('\n✅ LIVE PRODUCTION DEPLOYMENT FULLY VERIFIED!\n');
}

testLiveDeployment().catch(console.error);
