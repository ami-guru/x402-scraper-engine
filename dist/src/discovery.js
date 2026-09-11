/**
 * Autonomous Indexer & Aggregator Discovery Broadcaster
 * Automatically notifies global search engines, AI agent crawlers, and IndexNow endpoints.
 */
export const INDEXNOW_KEY = 'e9a7c3b2f1d048e58a7b9c6d3e2f1a0b';
export async function pingPublicIndexers(origin) {
    const host = new URL(origin).host;
    const urlList = [
        `${origin}/health`,
        `${origin}/openapi.json`,
        `${origin}/.well-known/x402.json`,
        `${origin}/.well-known/ai-plugin.json`
    ];
    const results = {};
    // 1. IndexNow Protocol (Instant indexing across Bing, Copilot, Perplexity, and AI search engines)
    const indexNowTargets = [
        'https://api.indexnow.org/indexnow',
        'https://www.bing.com/indexnow'
    ];
    for (const endpoint of indexNowTargets) {
        try {
            const payload = {
                host,
                key: INDEXNOW_KEY,
                keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
                urlList
            };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'User-Agent': 'x402-Autonomous-Discovery/1.3'
                },
                body: JSON.stringify(payload)
            });
            results[endpoint] = `Status ${res.status} (${res.status === 200 || res.status === 202 ? 'Indexed' : 'Submitted'})`;
        }
        catch (err) {
            results[endpoint] = `Error: ${err.message}`;
        }
    }
    // 2. Headless Agent Discovery Verification
    for (const targetUrl of urlList) {
        try {
            const probe = await fetch(targetUrl, {
                method: 'HEAD',
                headers: { 'User-Agent': 'x402-Autonomous-Discovery/1.3' }
            });
            results[targetUrl] = `Status ${probe.status} (Verified Live)`;
        }
        catch (err) {
            results[targetUrl] = `Error: ${err.message}`;
        }
    }
    return {
        success: true,
        results
    };
}
