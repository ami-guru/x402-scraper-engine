async function checkDomains() {
  const domains = [
    'https://ami.getguruautomations.com',
    'https://ami-audit.vercel.app',
    'https://ami-audit-git-main-gejoett-gmailcoms-projects.vercel.app',
    'https://ami-audit-git-root-gejoett-gmailcoms-projects.vercel.app',
    'https://ami-audit-guru-tt.vercel.app'
  ];

  for (const url of domains) {
    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      const html = await res.text();
      console.log(`[HTTP ${res.status}] ${url}`);
      console.log(`  Length: ${html.length} bytes | Contains 'USD UNIFIED': ${html.includes('USD UNIFIED')} | Contains 'modal-tabs': ${html.includes('modal-tabs')}`);
    } catch (e: any) {
      console.log(`[FAILED] ${url} -> ${e.message}`);
    }
  }
}

checkDomains();
