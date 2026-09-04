async function checkLiveAmi() {
  try {
    const timestamp = Date.now();
    const res = await fetch(`https://ami.getguruautomations.com/?_t=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    console.log(`[HTTP ${res.status}] ${res.url}`);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const html = await res.text();
    console.log(`HTML Length: ${html.length} bytes`);
    console.log(`Contains 'USD UNIFIED':`, html.includes('USD UNIFIED'));
    console.log(`Contains 'x402-scraper-engine':`, html.includes('x402-scraper-engine'));
    console.log(`Contains 'modal-tabs':`, html.includes('modal-tabs'));
    console.log(`Contains '0x4107f297256E00F32873f45F50A35a902c1c2034':`, html.includes('0x4107f297256E00F32873f45F50A35a902c1c2034'));
    console.log(`Contains 'ami@getguruautomations.com':`, html.includes('ami@getguruautomations.com'));
    console.log(`Title tag:`, html.match(/<title>(.*?)<\/title>/i)?.[1]);
  } catch (err: any) {
    console.error('Error fetching live AMI site:', err.message);
  }
}

checkLiveAmi();
