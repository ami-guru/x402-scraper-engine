/**
 * Zero-dependency, Edge-compatible HTML Sanitizer and Markdown Converter
 * Designed for token-efficient LLM context ingestion.
 */

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  markdownSummary?: string;
}

export interface SearchAndScrapeResult {
  query: string;
  results: SearchResultItem[];
  tokensEstimated: number;
}

// SSRF Protection: Block private IP ranges and internal hostnames
export function validateUrl(inputUrl: string): { valid: boolean; error?: string; url?: URL } {
  try {
    const parsed = new URL(inputUrl);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only http and https are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for loopback and local hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    ) {
      return { valid: false, error: 'Access to localhost/loopback addresses is prohibited for security.' };
    }

    // Block AWS / GCP / Cloud metadata endpoint
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: false, error: 'Access to cloud instance metadata is prohibited.' };
    }

    // IPv4 private subnet ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [_, o1, o2] = match.map(Number);
      if (
        o1 === 10 || // 10.0.0.0/8
        (o1 === 172 && o2 >= 16 && o2 <= 31) || // 172.16.0.0/12
        (o1 === 192 && o2 === 168) || // 192.168.0.0/16
        o1 === 127 || // 127.0.0.0/8
        o1 === 0 // 0.0.0.0/8
      ) {
        return { valid: false, error: 'Access to private internal IPv4 subnets is prohibited.' };
      }
    }

    return { valid: true, url: parsed };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Fetch and extract clean Markdown from a target URL
 */
export async function scrapeToMarkdown(targetUrl: string): Promise<{
  title: string;
  markdown: string;
  tokensEstimated: number;
}> {
  const urlCheck = validateUrl(targetUrl);
  if (!urlCheck.valid || !urlCheck.url) {
    throw new Error(urlCheck.error || 'Invalid URL');
  }

  // Fetch with realistic headers and 15s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(urlCheck.url.toString(), {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (ASOT-x402-Scraper/1.0; +https://getguruautomations.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    throw new Error(`Failed to fetch target URL: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
    // If plaintext or json, return raw
    const text = await response.text();
    return {
      title: urlCheck.url.hostname,
      markdown: text,
      tokensEstimated: estimateTokens(text)
    };
  }

  const rawHtml = await response.text();
  const { title, markdown } = htmlToMarkdown(rawHtml, urlCheck.url.origin);
  const tokensEstimated = estimateTokens(markdown);

  return {
    title,
    markdown,
    tokensEstimated
  };
}

/**
 * Convert HTML string to token-efficient Markdown
 */
export function htmlToMarkdown(html: string, baseUrl?: string): { title: string; markdown: string } {
  // 1. Extract Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

  // 2. Remove non-content tags & bloat
  let clean = html
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // <script>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // <style>
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '') // <svg>
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, '') // <canvas>
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '') // <noscript>
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // <iframe>
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '') // nav headers
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ''); // footers

  // Strip base64 data images
  clean = clean.replace(/<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi, '');

  // 3. Convert Headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 4. Convert Code Blocks & Inline Code
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n\n');
  clean = clean.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n');
  clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, ' `$1` ');

  // 5. Convert Blockquotes & HR
  clean = clean.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n');
  clean = clean.replace(/<hr[^>]*>/gi, '\n\n---\n\n');

  // 6. Convert Lists
  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  clean = clean.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // 7. Convert Links & Formatting
  clean = clean.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return '';
    let finalHref = href;
    if (baseUrl && href.startsWith('/')) {
      finalHref = `${baseUrl}${href}`;
    }
    return ` [${cleanText}](${finalHref}) `;
  });

  clean = clean.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, ' **$2** ');
  clean = clean.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, ' *$2* ');

  // 8. Paragraphs & Line Breaks
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/(p|div|section|article)>/gi, '\n\n');
  clean = clean.replace(/<(p|div|section|article)[^>]*>/gi, '');

  // 9. Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // 10. Decode HTML entities
  clean = decodeHtmlEntities(clean);

  // 11. Normalize Whitespace & Empty Lines
  clean = clean
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, markdown: clean };
}

/**
 * Decode common HTML entities
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Token Estimation Heuristic (Tokens are ~3.8-4 chars in English markdown)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Searches the web and scrapes top results into clean Markdown summaries
 */
export async function searchAndScrapeToMarkdown(
  query: string,
  limit: number = 3
): Promise<SearchAndScrapeResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error('Search query cannot be empty.');
  }

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let searchHtml = '';
  try {
    const searchRes = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!searchRes.ok) {
      throw new Error(`Search provider returned HTTP ${searchRes.status}`);
    }
    searchHtml = await searchRes.text();
  } catch (err: any) {
    throw new Error(`Search query execution failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse DuckDuckGo HTML results
  const results: SearchResultItem[] = [];
  const resultRegex = /<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const titleRegex = /<a\b[^>]*class=["'][^"']*result__url[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  // Extract result blocks
  const resultBlocks = searchHtml.split(/<div\b[^>]*class=["'][^"']*result\b[^"']*["']/i).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= limit) break;

    const titleMatch = block.match(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);

    if (titleMatch) {
      let rawHref = titleMatch[1];
      // DuckDuckGo redirects through /l/?uddg=...
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        rawHref = decodeURIComponent(uddgMatch[1]);
      }

      const check = validateUrl(rawHref);
      if (check.valid && check.url) {
        const itemTitle = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '').trim());
        const itemSnippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

        results.push({
          title: itemTitle || check.url.hostname,
          url: rawHref,
          snippet: itemSnippet
        });
      }
    }
  }

  // Fetch top results and scrape light markdown
  await Promise.all(
    results.map(async (item) => {
      try {
        const scraped = await scrapeToMarkdown(item.url);
        // Truncate individual scrape to first 1200 chars for token efficiency
        item.markdownSummary = scraped.markdown.slice(0, 1200) + (scraped.markdown.length > 1200 ? '\n\n*(Truncated for summary)*' : '');
      } catch (e) {
        item.markdownSummary = item.snippet;
      }
    })
  );

  const fullText = JSON.stringify(results);
  return {
    query: cleanQuery,
    results,
    tokensEstimated: estimateTokens(fullText)
  };
}
